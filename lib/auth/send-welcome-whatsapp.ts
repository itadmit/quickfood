/**
 * Sends the merchant welcome message over WhatsApp.
 *
 * Three routes, tried in order:
 *
 *   1. Quick Chat (Meta Cloud API) - the official one. Sends from QuickFood's
 *      verified number, cannot get a device banned, and puts the reply in the
 *      Quick Chat inbox the team already watches. We hand it both the full
 *      text and an approved template and let it pick by the 24-hour window:
 *      a fresh signup has never messaged us, so that is the template.
 *   2. MacroDroid - our own Android phone sending from the real WhatsApp app.
 *      Free, unofficial, and only as reliable as that phone being online.
 *   3. iBot - metered, unofficial, last resort.
 *
 * Quick Chat leads because it is the only route that is actually within
 * WhatsApp's terms. The two below it stay as fallbacks so a merchant still
 * gets their welcome if the template is mid-review or Quick Chat is down -
 * and they carry the full long-form text, which a template cannot.
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
import { isMacroDroidConfigured, sendViaMacroDroid } from "@/lib/whatsapp/macrodroid";
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

  if (isMacroDroidConfigured()) {
    const viaDevice = await sendViaMacroDroid({
      phone: local,
      message: msg,
      vars: {
        name: ownerName,
        business: businessName,
        dashboard: dashboardUrl,
        store: storeUrl,
      },
    });
    if (viaDevice.ok) return true;
    console.warn("[welcome-whatsapp] macrodroid failed, falling back to ibot:", viaDevice.detail);
  }

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
