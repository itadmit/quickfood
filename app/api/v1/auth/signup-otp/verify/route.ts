/**
 * POST /api/v1/auth/signup-otp/verify
 *
 * Trades a correct signup OTP for a short-lived phone_verify token. The
 * signup route requires that token (and that it matches owner_phone) before
 * it will create the account - this is what makes SMS verification a hard
 * gate rather than a cosmetic step.
 */
import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { toE164 } from "@/lib/format";
import { verifyOtp } from "@/lib/auth/otp";
import { signPhoneVerify } from "@/lib/auth/jwt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  phone: z.string().min(3).max(20),
  code: z.string().min(4).max(8),
});

export const POST = handler(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError("invalid_body", "קוד לא תקין", 422, "code");
  }

  const e164 = toE164(parsed.data.phone);
  if (!e164) {
    return apiError("invalid_phone", "מספר נייד לא תקין", 422, "phone");
  }

  const ok = await verifyOtp(e164, parsed.data.code.trim());
  if (!ok) {
    return apiError("otp_invalid", "הקוד שגוי או שפג תוקפו", 422, "code");
  }

  const token = await signPhoneVerify(e164);
  return apiJson({ verified: true, token });
});
