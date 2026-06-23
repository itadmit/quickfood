/**
 * Sends a login OTP over WhatsApp using the PLATFORM iBot account
 * (platform_settings.whatsapp_default_*), not a tenant's. A merchant logging
 * in hasn't picked a tenant yet and must never be charged SMS credits for
 * their own login, so this bypasses the tenant-scoped sendWhatsApp() credit
 * accounting and talks to iBot directly via callIBotSendText().
 *
 * Returns true when the code went out (or was console-logged in dev). On a
 * missing platform config / bad number / iBot failure it returns false so the
 * caller can fall back to email or surface a soft error.
 */
import { prisma } from "@/lib/db/client";
import {
  callIBotSendText,
  normalizePhone,
  isValidIsraeliMobile,
  toJid,
} from "@/lib/whatsapp/send";

// Only fake a send when EXPLICITLY opted in. If we fell back on an unset
// provider too, a real prod creds-outage would silently "succeed" and the
// merchant would wait for a code that never arrives.
const CONSOLE_FALLBACK =
  process.env.WHATSAPP_PROVIDER === "console" ||
  process.env.SMS_PROVIDER === "console";

export async function sendOtpWhatsApp(
  phoneE164: string,
  code: string,
): Promise<boolean> {
  const local = normalizePhone(phoneE164); // +9725.. → 05..
  if (!isValidIsraeliMobile(local)) return false;

  const msg =
    `קוד הכניסה שלך ל-QuickFood: ${code}\n\n` +
    `הקוד בתוקף ל-10 דקות. אם לא ביקשת קוד, אפשר להתעלם מההודעה.`;

  const platform = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: {
      whatsappDefaultToken: true,
      whatsappDefaultInstanceId: true,
    },
  });

  if (!platform?.whatsappDefaultToken || !platform.whatsappDefaultInstanceId) {
    if (CONSOLE_FALLBACK) {
      // eslint-disable-next-line no-console
      console.log(`[otp:whatsapp:console] ${local} ← ${code}`);
      return true;
    }
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
