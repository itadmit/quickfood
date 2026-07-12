/**
 * Sends the merchant welcome message over WhatsApp using the PLATFORM iBot
 * account (platform_settings.whatsapp_default_*), same as the login OTP -
 * the sender is QuickFood's own number, so "just reply to this message"
 * works as the support channel and no tenant SMS credits are charged.
 *
 * Fire-and-forget from the signup after() block: returns false on missing
 * config / bad number / iBot failure so the caller can log and move on.
 */
import { prisma } from "@/lib/db/client";
import {
  callIBotSendText,
  normalizePhone,
  isValidIsraeliMobile,
  toJid,
} from "@/lib/whatsapp/send";

export async function sendWelcomeWhatsApp({
  phone,
  ownerName,
  businessName,
  dashboardUrl,
  storeUrl,
}: {
  phone: string;
  ownerName: string;
  businessName: string;
  dashboardUrl: string;
  storeUrl: string;
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
    `• שתפו את לינק החנות עם הלקוחות\n\n` +
    `כניסה לדשבורד:\n${dashboardUrl}\n\n` +
    `החנות שלכם באוויר כאן:\n${storeUrl}\n\n` +
    `צריכים עזרה? פשוט השיבו להודעה הזאת ונשמח לעזור.`;

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
