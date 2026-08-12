import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { normalizeEmail, verifyEmailOtp } from "@/lib/auth/otp";
import { findMerchantByEmail } from "@/lib/auth/merchant-by-email";
import { prisma } from "@/lib/db/client";
import { issueTokensForMerchant, setSessionCookies } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(160),
  code: z.string().length(6).regex(/^\d{6}$/),
  client_type: z.enum(["web", "mobile"]).default("web"),
});

export const POST = handler(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError("validation_error", "קוד לא תקין", 422, "code");

  const email = normalizeEmail(parsed.data.email);

  const ok = await verifyEmailOtp(email, parsed.data.code);
  if (!ok) return apiError("invalid_otp", "קוד שגוי או פג תוקף", 401, "code");

  const merchant = await findMerchantByEmail(email);
  if (!merchant) return apiError("no_account", "לא נמצא חשבון לכתובת הזו", 404, "email");

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

  if (parsed.data.client_type === "web") {
    await setSessionCookies(accessToken, refreshToken);
    return apiJson({ user: userPayload });
  }
  return apiJson({
    access_token: accessToken,
    refresh_token: refreshToken,
    user: userPayload,
  });
});
