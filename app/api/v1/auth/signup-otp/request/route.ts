/**
 * POST /api/v1/auth/signup-otp/request
 *
 * Issues a 6-digit OTP to the prospective merchant's email during signup
 * (step 3) and sends it with Resend. No tenant exists yet, so this is a
 * platform-level send. The verify endpoint trades a correct code for a
 * short-lived email_verify token.
 */
import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { issueEmailOtp, normalizeEmail } from "@/lib/auth/otp";
import { sendEmail } from "@/lib/email/send";
import { otpEmail } from "@/lib/email/templates";
import { checkRate } from "@/lib/api/rate-limit";
import { hitDurable } from "@/lib/api/durable-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().email().max(160) });

const THROTTLE_SECONDS = 60;

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("true-client-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export const POST = handler(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError("invalid_email", "כתובת מייל לא תקינה", 422, "email");
  }

  const email = normalizeEmail(parsed.data.email);

  // Free to send, but still capped: an open endpoint is a mail-bomb relay
  // pointed at whatever address the attacker types, on our sending domain.
  checkRate(`signup-otp:ip:${clientIp(req)}`, 8);
  checkRate(`signup-otp:email:${email}`, 4);
  if (!(await hitDurable(`signup-otp:ip:${clientIp(req)}`, 10, 10 * 60_000))) {
    return apiError("rate_limited", "נחסמת זמנית עקב יותר מדי בקשות. נסו שוב בעוד כמה דקות.", 429);
  }

  const recent = await prisma.otpCode.findFirst({
    where: {
      email,
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

  const { code, expiresAt } = await issueEmailOtp(email);
  const minutes = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
  const { html, text } = otpEmail({ code, expiresInMinutes: minutes, purpose: "signup" });

  const res = await sendEmail({
    tenantId: null,
    to: email,
    subject: `QuickFood · קוד האימות שלך: ${code}`,
    body: text,
    html,
    kind: "signup_otp",
  });

  if (res.status !== "sent") {
    return apiError(
      "delivery_failed",
      "לא הצלחנו לשלוח את קוד האימות. בדקו את הכתובת ונסו שוב.",
      502,
      "email",
    );
  }

  return apiJson({
    sent: true,
    channel: "email",
    retry_in: THROTTLE_SECONDS,
    expires_in: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
});
