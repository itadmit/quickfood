/**
 * POST /api/v1/auth/signup-otp/request
 *
 * Issues a 6-digit OTP to the prospective merchant's personal mobile during
 * signup (step 3) and sends it via SMS (sms4free). No tenant exists yet, so
 * this uses the platform-level sendRawSms - the platform absorbs the cost.
 *
 * Throttle: if an unused, unexpired code was issued for this phone in the
 * last 60s we don't re-send (double-tap + budget guard). The verify endpoint
 * trades a correct code for a short-lived phone_verify token.
 */
import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { toE164 } from "@/lib/format";
import { issueOtp } from "@/lib/auth/otp";
import { sendRawSms } from "@/lib/sms/send-raw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ phone: z.string().min(3).max(20) });

const THROTTLE_SECONDS = 60;

export const POST = handler(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError("invalid_body", "מספר טלפון לא תקין", 422, "phone");
  }

  const e164 = toE164(parsed.data.phone);
  if (!e164) {
    return apiError("invalid_phone", "מספר נייד לא תקין", 422, "phone");
  }

  const recent = await prisma.otpCode.findFirst({
    where: {
      phone: e164,
      usedAt: null,
      expiresAt: { gt: new Date() },
      createdAt: { gt: new Date(Date.now() - THROTTLE_SECONDS * 1000) },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, expiresAt: true },
  });
  if (recent) {
    const waitSeconds = Math.max(
      1,
      THROTTLE_SECONDS - Math.floor((Date.now() - recent.createdAt.getTime()) / 1000),
    );
    return apiJson({
      sent: true,
      throttled: true,
      retry_in: waitSeconds,
      expires_in: Math.max(0, Math.floor((recent.expiresAt.getTime() - Date.now()) / 1000)),
    });
  }

  const { code, expiresAt } = await issueOtp(e164);

  // sms4free wants the local 05X form, not the +972 we key OtpCode by.
  const localPhone = e164.startsWith("+972") ? "0" + e164.slice(4) : e164;
  const body =
    `QuickFood · קוד אימות: ${code}\n` +
    `הקוד תקף ל-10 דקות. אם לא ביקשתם - אפשר להתעלם.`;

  const res = await sendRawSms(localPhone, body);
  if (res.status !== "sent") {
    return apiError(
      "delivery_failed",
      "לא הצלחנו לשלוח את קוד האימות. בדקו את המספר ונסו שוב.",
      502,
    );
  }

  return apiJson({
    sent: true,
    retry_in: THROTTLE_SECONDS,
    expires_in: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
});
