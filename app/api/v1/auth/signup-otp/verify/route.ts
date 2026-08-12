/**
 * POST /api/v1/auth/signup-otp/verify
 *
 * Trades a correct signup OTP for a short-lived email_verify token. The
 * signup route requires that token (and that it matches owner_email) before
 * it will create the account - this is what makes email verification a hard
 * gate rather than a cosmetic step.
 */
import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { normalizeEmail, verifyEmailOtp } from "@/lib/auth/otp";
import { signEmailVerify } from "@/lib/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(160),
  code: z.string().min(4).max(8),
});

export const POST = handler(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError("invalid_body", "קוד לא תקין", 422, "code");
  }

  const email = normalizeEmail(parsed.data.email);

  const ok = await verifyEmailOtp(email, parsed.data.code.trim());
  if (!ok) {
    return apiError("otp_invalid", "הקוד שגוי או שפג תוקפו", 422, "code");
  }

  const token = await signEmailVerify(email);
  return apiJson({ verified: true, token });
});
