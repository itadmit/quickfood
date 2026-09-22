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
 * There is deliberately no fallback. Both previous ones were unofficial: the
 * MacroDroid relay drove an Android phone of ours into the real WhatsApp app,
 * and iBot is an unofficial gateway. Each worked right up until the sending
 * number got banned, and neither put replies anywhere a person watched.
 * `signup_confirmation` is APPROVED, so the official route covers this send
 * on its own - and a failure that shows up in logs is worth more than a
 * silent fall back onto something that can cost us the number.
 *
 * Fire-and-forget from the signup after() block: returns false on missing
 * config / bad number / provider failure so the caller can log and move on.
 */
import { normalizePhone, isValidIsraeliMobile } from "@/lib/whatsapp/send";
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

  if (!isQuickChatConfigured()) {
    console.warn("[welcome-whatsapp] QUICKCHAT_API_KEY missing - nothing sent");
    return false;
  }

  const sent = await sendViaQuickChat({
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

  if (!sent.ok) {
    console.error("[welcome-whatsapp] quickchat send failed:", sent.detail);
    return false;
  }

  console.info(
    `[welcome-whatsapp] quickchat ok (${sent.detail})${sent.billable ? " [billed]" : ""}`,
  );
  return true;
}
