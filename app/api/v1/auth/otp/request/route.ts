import { handler, apiJson } from "@/lib/api-response";
import { OtpRequestSchema } from "@/lib/validate";
import { issueOtp } from "@/lib/auth/otp";
import { toE164 } from "@/lib/format";
import { apiError } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const body = OtpRequestSchema.parse(await req.json());
  const phone = toE164(body.phone);
  if (!phone) return apiError("validation_error", "מספר טלפון לא תקין", 422, "phone");

  const { code, expiresAt } = await issueOtp(phone);

  // MVP: log the code to the server console so we can test without SMS provider.
  if (process.env.SMS_PROVIDER === "console" || !process.env.SMS_PROVIDER) {
    console.log(`[otp] ${phone} ← ${code}`);
  }
  // TODO: integrate SMS provider (sms4free / twilio) - read SMS_PROVIDER

  return apiJson({
    sent: true,
    expires_in: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
});
