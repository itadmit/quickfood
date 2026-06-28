import { formatPrice } from "@/lib/format";
import {
  getDirectCustomerOverview,
  getSourceBreakdown,
  getQrCampaignPerformance,
  type DateRange,
} from "./analytics";
import { generateAiInsights } from "./ai";

export interface GrowthInsight {
  id: string;
  // The observation, phrased as an action - never a passive report.
  title: string;
  body: string;
  expectedImpact?: string;
  priority: "high" | "medium" | "low";
  actionType?: string;
  actionLabel?: string;
  actionPayload?: Record<string, unknown>;
}

/**
 * The AI Growth Manager's insights. Tries the tenant's LLM first (phrasing +
 * prioritisation over the SAME deterministic facts), and falls back to the
 * rule-based list when no AI is configured or the call fails/ times out. The
 * facts are always computed here so the model can never invent numbers.
 */
export async function getGrowthInsights(
  tenantId: string,
  range: DateRange,
): Promise<GrowthInsight[]> {
  const [overview, sources, qr] = await Promise.all([
    getDirectCustomerOverview(tenantId, range),
    getSourceBreakdown(tenantId, range),
    getQrCampaignPerformance(tenantId, range),
  ]);

  const out: GrowthInsight[] = [];

  // QR scanned but didn't convert -> stronger offer.
  if (overview.qrScans >= 20 && overview.scanToOrderRate < 0.25) {
    const pct = Math.round(overview.scanToOrderRate * 100);
    out.push({
      id: "qr_low_conversion",
      title: `${overview.qrScans} אנשים סרקו את ה-QR, אבל רק ${pct}% הזמינו`,
      body: "נסו להציע קינוח חינם במקום 10% הנחה - הטבה מוחשית ממירה טוב יותר מאחוזים.",
      expectedImpact: "צפי לעלייה בהמרה של כ-12%",
      priority: "high",
      actionType: "create_coupon",
      actionLabel: "צרו הטבה",
      actionPayload: { preset: "free_dessert" },
    });
  }

  // Low repeat rate -> comeback coupon.
  if (overview.directCustomersAcquired >= 10 && overview.repeatRate < 0.15) {
    const pct = Math.round(overview.repeatRate * 100);
    out.push({
      id: "low_repeat",
      title: `רק ${pct}% מהלקוחות מזמינים פעם שנייה`,
      body: "צרו קופון החזרה ל-7 ימים אחרי ההזמנה הראשונה - הדחיפה שהופכת לקוח חד-פעמי לקבוע.",
      expectedImpact: "כל אחוז שיפור = הכנסה חוזרת",
      priority: "high",
      actionType: "create_coupon",
      actionLabel: "צרו קופון החזרה",
      actionPayload: { preset: "comeback_7d" },
    });
  }

  // Best source -> double down (e.g. Google -> GBP link).
  if (overview.bestSource && overview.bestSource.revenue > 0) {
    const s = overview.bestSource;
    out.push({
      id: "best_source",
      title: `המקור הכי חזק החודש: ${s.label}`,
      body: `לקוחות מ-${s.label} הביאו ${formatPrice(s.revenue)}. כדאי להגביר נוכחות שם ולוודא שקישור ההזמנה הישיר מופיע.`,
      expectedImpact: "מיקסום הערוץ שכבר עובד",
      priority: "medium",
      actionType: "external_action",
      actionLabel: "צרו קמפיין למקור הזה",
    });
  }

  // High AOV source comparison.
  const ranked = sources.filter((s) => s.customers > 0).sort((a, b) => b.avgOrderValue - a.avgOrderValue);
  if (ranked.length >= 2 && ranked[0].avgOrderValue > ranked[1].avgOrderValue * 1.2) {
    out.push({
      id: "aov_source",
      title: `לקוחות מ-${ranked[0].label} מזמינים בסכום גבוה יותר`,
      body: `ההזמנה הממוצעת מ-${ranked[0].label} היא ${formatPrice(ranked[0].avgOrderValue)} - גבוהה מהשאר. שווה להשקיע שם יותר.`,
      priority: "low",
      actionType: "external_action",
      actionLabel: "ראו פירוט מקורות",
    });
  }

  // Commission saved headline.
  if (overview.estimatedCommissionSaved > 0) {
    out.push({
      id: "commission_saved",
      title: `חסכתם משוערים ${formatPrice(overview.estimatedCommissionSaved)} בעמלות`,
      body: `לקוחות שהגיעו דרך פלטפורמות חיצוניות והזמינו ישירות מהאתר שלכם חסכו לכם הערכה של ${formatPrice(overview.estimatedCommissionSaved)} בעמלות שוק. כל לקוח ישיר נוסף מגדיל את המספר.`,
      expectedImpact: "הגדלת החיסכון מול אפליקציות המשלוחים",
      priority: "medium",
      actionType: "create_qr",
      actionLabel: "צרו עוד QR להמרה",
    });
  }

  // No QR campaigns at all.
  if (qr.length === 0) {
    out.push({
      id: "no_qr",
      title: "עדיין אין לכם קמפיין QR",
      body: "QR על שקיות המשלוח הוא הדרך הזולה ביותר להפוך לקוחות של אפליקציות ללקוחות ישירים.",
      expectedImpact: "תחילת מנוע הרכישה הישירה",
      priority: "high",
      actionType: "create_qr",
      actionLabel: "צרו קמפיין QR",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  const ruleBased = out.sort((a, b) => order[a.priority] - order[b.priority]);

  // Hand the model the SAME computed facts (no raw data) and let it phrase +
  // prioritise. Falls back to the rule-based list on null.
  const facts = {
    directCustomersAcquired: overview.directCustomersAcquired,
    firstDirectOrders: overview.firstDirectOrders,
    repeatDirectOrders: overview.repeatDirectOrders,
    directRevenue: overview.directRevenue,
    estimatedCommissionSaved: overview.estimatedCommissionSaved,
    commissionRatePct: overview.commissionRate,
    qrScans: overview.qrScans,
    scanToOrderRatePct: Math.round(overview.scanToOrderRate * 100),
    repeatRatePct: Math.round(overview.repeatRate * 100),
    unattributedSharePct: Math.round(overview.unattributedShare * 100),
    bestSource: overview.bestSource,
    qrCampaignCount: qr.length,
    sources: sources.map((s) => ({
      label: s.label,
      category: s.category,
      customers: s.customers,
      revenue: s.revenue,
      avgOrderValue: s.avgOrderValue,
      selfReported: s.selfReported,
    })),
  };

  const ai = await generateAiInsights(tenantId, facts);
  return ai ?? ruleBased;
}
