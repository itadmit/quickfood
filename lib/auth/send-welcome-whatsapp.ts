/**
 * Sends the merchant welcome message over WhatsApp.
 *
 * Quick Chat (Meta Cloud API) is the route. It sends from QuickFood's own
 * verified business number, is the only one actually within WhatsApp's terms,
 * and puts the merchant's reply in the Quick Chat inbox the team works in.
 *
 * One call covers both sides of Meta's 24-hour rule: we hand Quick Chat the
 * full text *and* the approved `signup_confirmation` template and let it pick.
 * A fresh signup has never messaged us, so that is the template; the free-text
 * branch is what a returning merchant gets, at no charge.
 *
 * The MacroDroid relay - an Android phone of ours replaying into the real
 * WhatsApp app - is gone. It was free and entirely outside WhatsApp's terms:
 * it worked right up until the number got banned, and nobody watched the
 * replies it collected.
 *
 * iBot stays as a single fallback, and only until `signup_confirmation` clears
 * Meta's review. Until then a template send fails and a new merchant would get
 * no welcome at all. Once the template is APPROVED, delete the block at the
 * bottom of this file and the import with it.
 *
 * Fire-and-forget from the signup after() block: returns false on missing
 * config / bad number / provider failure so the caller can log and move on.
 */
import { prisma } from "@/lib/db/client";
import {
  callIBotSendText,
  normalizePhone,
  isValidIsraeliMobile,
  toJid,
} from "@/lib/whatsapp/send";
import { isQuickChatConfigured, sendViaQuickChat } from "@/lib/whatsapp/quickchat";

/** Approved UTILITY template on QuickFood's WABA. Body takes {{1}}=owner
 *  name, {{2}}=business name. */
const SIGNUP_TEMPLATE = process.env.QUICKCHAT_SIGNUP_TEMPLATE?.trim() || "signup_confirmation";

export async function sendWelcomeWhatsApp({
  phone,
  ownerName,
  businessName,
  dashboardUrl,
  storeUrl,
  tenantId,
}: {
  phone: string;
  ownerName: string;
  businessName: string;
  dashboardUrl: string;
  storeUrl: string;
  /** Idempotency anchor - one welcome per tenant, however many retries. */
  tenantId: string;
}): Promise<boolean> {
  const local = normalizePhone(phone);
  if (!isValidIsraeliMobile(local)) return false;

  const msg =
    `שלום ${ownerName}, ברוכים הבאים ל-QuickFood!\n\n` +
    `החנות *${businessName}* נוצרה בהצלחה, ותקופת הניסיון שלך - 7 ימים, ` +
    `גישה מלאה לכל הפיצ׳רים, בלי כרטיס אשראי - כבר פעילה.\n\n` +
    `צעדים ראשונים מומלצים:\n` +
    `• הוסיפו תפריט (אפשר להעלות תפריט שלם, לייבא מוולט בקליק, או לשלוח לנו את התפריט ואנחנו נזין לכם ללא עלות ובמהירות)\n` +
    `• הגדירו שעות פעילות ואמצעי תשלום\n` +
    `• חברו סליקה באשראי לאתר שלכם https://quickfood.co.il/connect-payment\n\n` +
    `כניסה לדשבורד:\n${dashboardUrl}\n\n` +
    `החנות שלכם באוויר כאן:\n${storeUrl}\n\n` +
    `צריכים עזרה? פשוט השיבו להודעה הזאת ונשמח לעזור.`;

  if (isQuickChatConfigured()) {
    const viaQuickChat = await sendViaQuickChat({
      phone: local,
      text: msg,
      contactName: ownerName,
      template: {
        name: SIGNUP_TEMPLATE,
        language: "he",
        variables: [ownerName, businessName],
      },
      idempotencyKey: `qf-signup-welcome:${tenantId}`,
    });
    if (viaQuickChat.ok) {
      console.info(
        `[welcome-whatsapp] quickchat ok (${viaQuickChat.detail})` +
          `${viaQuickChat.billable ? " [billed]" : ""}`,
      );
      return true;
    }
    console.warn("[welcome-whatsapp] quickchat failed, falling back:", viaQuickChat.detail);
  }

  // ── Temporary: remove once `signup_confirmation` is APPROVED ──────────
  const platform = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: {
      whatsappDefaultToken: true,
      whatsappDefaultInstanceId: true,
    },
  });

  if (!platform?.whatsappDefaultToken || !platform.whatsappDefaultInstanceId) {
    return false;
  }

  const res = await callIBotSendText({
    token: platform.whatsappDefaultToken,
    instanceId: platform.whatsappDefaultInstanceId,
    jid: toJid(local),
    msg,
  });
  return res.ok;
}
