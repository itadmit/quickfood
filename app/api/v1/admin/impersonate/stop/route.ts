import { handler, apiJson, apiError } from "@/lib/api-response";
import { verifyAccess } from "@/lib/auth/jwt";
import {
  issueTokensForMerchant,
  setSessionCookies,
  readAdminReturnToken,
  clearAdminReturnCookie,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * End impersonation - restore the platform admin's session from the signed
 * return cookie. Authenticated purely by possession of that signed cookie
 * (the live session here is the impersonated merchant, not the admin), so it
 * deliberately does NOT call requireAdmin.
 */
export const POST = handler(async () => {
  const token = await readAdminReturnToken();
  if (!token) return apiError("forbidden", "אין הרשאת חזרה", 403);

  const claims = await verifyAccess(token);
  if (!claims || claims.role !== "platform_admin") {
    await clearAdminReturnCookie();
    return apiError("forbidden", "טוקן חזרה לא תקין", 403);
  }

  const { accessToken, refreshToken } = await issueTokensForMerchant(
    claims.sub,
    claims.tid ?? null,
    "platform_admin",
  );
  await setSessionCookies(accessToken, refreshToken);
  await clearAdminReturnCookie();

  return apiJson({ redirect: "/admin" });
});
