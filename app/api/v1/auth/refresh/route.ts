import { z } from "zod";
import { cookies } from "next/headers";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { verifyRefresh } from "@/lib/auth/jwt";
import {
  issueTokensForMerchant,
  issueTokensForCustomer,
  setSessionCookies,
  REFRESH_COOKIE,
} from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  refresh_token: z.string().optional(),
  client_type: z.enum(["web", "mobile"]).optional(),
});

/**
 * Roll a fresh access token (and rotate the refresh token) from a still-valid
 * refresh token. Mobile sends `refresh_token` in the body and gets new tokens
 * back; web omits it (read from the qf_refresh cookie) and gets refreshed
 * cookies. The refresh token is stateless (signature-only), so we re-read the
 * user to repopulate role/tenant on the new access claims.
 */
export const POST = handler(async (req: Request) => {
  const body = Body.parse(await req.json().catch(() => ({})));

  let token = body.refresh_token;
  if (!token) {
    const jar = await cookies();
    token = jar.get(REFRESH_COOKIE)?.value;
  }
  if (!token) return apiError("unauthorized", "נדרשת התחברות מחדש", 401);

  const claims = await verifyRefresh(token);
  if (!claims?.sub) return apiError("invalid_token", "טוקן הרענון אינו תקף", 401);

  if (claims.typ === "merchant") {
    const user = await prisma.merchantUser.findUnique({
      where: { id: claims.sub },
      include: { tenant: { select: { id: true, slug: true, name: true, themeId: true } } },
    });
    if (!user) return apiError("unauthorized", "המשתמש לא נמצא", 401);

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
  }

  // Customer refresh
  const customer = await prisma.customer.findUnique({ where: { id: claims.sub } });
  if (!customer) return apiError("unauthorized", "המשתמש לא נמצא", 401);
  const { accessToken, refreshToken } = await issueTokensForCustomer(customer.id);
  if (body.client_type === "web") {
    await setSessionCookies(accessToken, refreshToken);
    return apiJson({ ok: true });
  }
  return apiJson({ access_token: accessToken, refresh_token: refreshToken });
});
