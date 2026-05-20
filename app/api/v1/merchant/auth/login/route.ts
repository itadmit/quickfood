import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { MerchantLoginSchema } from "@/lib/validate";
import { prisma } from "@/lib/db/client";
import { issueTokensForMerchant, setSessionCookies } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const body = MerchantLoginSchema.parse(await req.json());

  const user = await prisma.merchantUser.findUnique({
    where: { email: body.email.toLowerCase() },
    include: { tenant: { select: { id: true, slug: true, name: true, themeId: true } } },
  });
  if (!user) return apiError("invalid_credentials", "אימייל או סיסמה שגויים", 401);

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) return apiError("invalid_credentials", "אימייל או סיסמה שגויים", 401);

  await prisma.merchantUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const { accessToken, refreshToken } = await issueTokensForMerchant(
    user.id,
    user.tenantId,
    user.role,
  );

  const userPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenant: user.tenant,
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
