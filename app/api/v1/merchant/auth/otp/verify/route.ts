import { handler, apiJson, apiError } from "@/lib/api-response";
import { OtpVerifySchema } from "@/lib/validate";
import { verifyOtp } from "@/lib/auth/otp";
import { findMerchantByPhone } from "@/lib/auth/merchant-by-phone";
import { prisma } from "@/lib/db/client";
import { toE164 } from "@/lib/format";
import { issueTokensForMerchant, setSessionCookies } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const body = OtpVerifySchema.parse(await req.json());
  const phone = toE164(body.phone);
  if (!phone) return apiError("validation_error", "מספר טלפון לא תקין", 422, "phone");

  const ok = await verifyOtp(phone, body.code);
  if (!ok) return apiError("invalid_otp", "קוד שגוי או פג תוקף", 401, "code");

  const merchant = await findMerchantByPhone(phone);
  if (!merchant) return apiError("no_account", "לא נמצא חשבון למספר הזה", 404, "phone");

  await prisma.merchantUser.update({
    where: { id: merchant.id },
    data: { lastLoginAt: new Date() },
  });

  const { accessToken, refreshToken } = await issueTokensForMerchant(
    merchant.id,
    merchant.tenantId,
    merchant.role,
  );

  const userPayload = {
    id: merchant.id,
    email: merchant.email,
    name: merchant.name,
    role: merchant.role,
    tenant: merchant.tenant,
  };

  if (body.client_type === "web") {
    await setSessionCookies(accessToken, refreshToken);
    return apiJson({ user: userPayload });
  }
  return apiJson({
    access_token: accessToken,
    refresh_token: refreshToken,
    user: userPayload,
  });
});
