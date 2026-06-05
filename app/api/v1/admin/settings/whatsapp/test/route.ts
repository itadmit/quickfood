/**
 * Smoke-test the platform-wide iBot fallback credentials.
 *
 * Reads the singleton `platform_settings` row, sends a single text message
 * via iBot, and reports the raw provider response. Does NOT write to the
 * unified `sms_logs` table (no tenant context) and does NOT decrement any
 * credits - this is a connectivity check, not a customer-bound message.
 *
 * Returns:
 *   { ok: true, message }              - provider returned success
 *   { ok: false, reason, message? }    - bad phone / not configured / failed
 */
import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import {
  callIBotSendText,
  isValidIsraeliMobile,
  normalizePhone,
  toJid,
} from "@/lib/whatsapp/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  to: z.string().min(7).max(20),
});

export const POST = handler(async (req: Request) => {
  await requireAdmin();
  const { to: rawTo } = Schema.parse(await req.json());

  const settings = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: {
      whatsappDefaultToken: true,
      whatsappDefaultInstanceId: true,
    },
  });
  if (
    !settings ||
    !settings.whatsappDefaultToken ||
    !settings.whatsappDefaultInstanceId
  ) {
    return apiError(
      "not_configured",
      "חסר Token או Instance ID. שמור את ההגדרות לפני שליחת בדיקה.",
      400,
    );
  }

  const to = normalizePhone(rawTo);
  if (!isValidIsraeliMobile(to)) {
    return apiError(
      "invalid_recipient",
      "מספר טלפון לא תקין (פורמט: 05XXXXXXXX)",
      422,
    );
  }

  const result = await callIBotSendText({
    token: settings.whatsappDefaultToken,
    instanceId: settings.whatsappDefaultInstanceId,
    jid: toJid(to),
    msg: "QuickFood - בדיקת חיבור WhatsApp ברירת מחדל. אם קיבלת - הכל מחובר.",
  });

  return apiJson({
    ok: result.ok,
    message: result.message,
  });
});
