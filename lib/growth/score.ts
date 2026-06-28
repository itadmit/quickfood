import { prisma } from "@/lib/db/client";
import { resolveLoyaltyConfig } from "@/lib/loyalty/config";

export interface ChecklistItem {
  key: string;
  title: string;
  description: string;
  weight: number;
  actionType: string;
  actionPayload?: Record<string, unknown>;
  done: boolean;
  // Auto-detected from real config vs. a manual "mark as done" toggle.
  auto: boolean;
}

interface ChecklistContext {
  loyaltyActive: boolean;
  birthdayActive: boolean;
  qrCampaignCount: number;
  couponCount: number;
  loyaltyMemberCount: number;
  completedKeys: Set<string>;
}

// The Shopify-style Growth Checklist. `auto` items derive their done-state
// from real config/data; manual items are completed by the merchant and
// stored as a GrowthTask row with the matching key + status=completed.
function buildChecklist(ctx: ChecklistContext): ChecklistItem[] {
  const manual = (key: string) => ctx.completedKeys.has(key);
  return [
    {
      key: "create_qr",
      title: "צרו קמפיין QR ראשון",
      description: "קוד שתדביקו על שקיות המשלוח כדי שלקוחות יזמינו ישירות בפעם הבאה.",
      weight: 15,
      actionType: "create_qr",
      done: ctx.qrCampaignCount > 0,
      auto: true,
    },
    {
      key: "print_bag_qr",
      title: "הדפיסו והדביקו QR על שקיות המשלוח",
      description: "כל שקית שיוצאת היא הזדמנות להפוך לקוח חיצוני ללקוח ישיר.",
      weight: 10,
      actionType: "external_action",
      done: manual("print_bag_qr"),
      auto: false,
    },
    {
      key: "first_order_reward",
      title: "צרו הטבה להזמנה ישירה ראשונה",
      description: "קופון של 10% או קינוח חינם שמושך לקוחות להזמין מהאתר שלכם.",
      weight: 12,
      actionType: "create_coupon",
      actionPayload: { preset: "first_direct_order" },
      done: ctx.couponCount > 0,
      auto: true,
    },
    {
      key: "enable_loyalty",
      title: "הפעילו את מועדון הלקוחות",
      description: "לקוחות במועדון מזמינים שוב פי 2.3. בלי זה אתם משאירים כסף על השולחן.",
      weight: 15,
      actionType: "edit_loyalty",
      done: ctx.loyaltyActive,
      auto: true,
    },
    {
      key: "enable_birthday",
      title: "הפעילו הטבת יום הולדת",
      description: "קופון אוטומטי בכל יום הולדת - מביא לקוחות חזרה בלי מאמץ.",
      weight: 10,
      actionType: "edit_loyalty",
      actionPayload: { section: "birthday" },
      done: ctx.birthdayActive,
      auto: true,
    },
    {
      key: "connect_gbp",
      title: "הוסיפו קישור הזמנה לפרופיל העסק בגוגל",
      description: "אנשים שמחפשים אתכם בגוגל יזמינו ישירות במקום דרך אפליקציית משלוחים.",
      weight: 12,
      actionType: "external_link",
      actionPayload: { url: "https://business.google.com" },
      done: manual("connect_gbp"),
      auto: false,
    },
    {
      key: "instagram_bio",
      title: "הוסיפו את קישור ההזמנה לביו באינסטגרם",
      description: "כל מבקר בפרופיל יכול להזמין בלחיצה - בלי עמלות.",
      weight: 8,
      actionType: "external_action",
      done: manual("instagram_bio"),
      auto: false,
    },
    {
      key: "referral_program",
      title: "הפעילו תוכנית 'חבר מביא חבר'",
      description: "לקוחות מרוצים מביאים לקוחות חדשים - הזול ביותר לרכישה.",
      weight: 8,
      actionType: "external_action",
      done: manual("referral_program"),
      auto: false,
    },
  ];
}

export interface GrowthScoreResult {
  score: number; // 0..100
  checklist: ChecklistItem[];
  completed: number;
  total: number;
  // The AI "why" - the incomplete items, highest-impact first.
  reasons: string[];
}

export async function getGrowthScore(tenantId: string): Promise<GrowthScoreResult> {
  const [tenant, qrCampaignCount, couponCount, loyaltyMemberCount, completedTasks] =
    await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { loyaltyConfig: true, name: true } }),
      prisma.qrCampaign.count({ where: { tenantId } }),
      prisma.coupon.count({ where: { tenantId } }),
      prisma.loyaltyMember.count({ where: { tenantId } }),
      prisma.growthTask.findMany({
        where: { tenantId, status: "completed" },
        select: { key: true },
      }),
    ]);

  const loyalty = resolveLoyaltyConfig(tenant?.loyaltyConfig, tenant?.name ?? "העסק");
  const ctx: ChecklistContext = {
    loyaltyActive: loyalty.showJoinPopup || loyalty.showCheckoutCheckbox || loyaltyMemberCount > 0,
    birthdayActive: loyalty.birthdayBenefit,
    qrCampaignCount,
    couponCount,
    loyaltyMemberCount,
    completedKeys: new Set(completedTasks.map((t) => t.key)),
  };

  const checklist = buildChecklist(ctx);
  const totalWeight = checklist.reduce((s, i) => s + i.weight, 0);
  const doneWeight = checklist.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);
  const score = totalWeight > 0 ? Math.round((100 * doneWeight) / totalWeight) : 0;

  const reasons = checklist
    .filter((i) => !i.done)
    .sort((a, b) => b.weight - a.weight)
    .map((i) => i.title);

  return {
    score,
    checklist,
    completed: checklist.filter((i) => i.done).length,
    total: checklist.length,
    reasons,
  };
}
