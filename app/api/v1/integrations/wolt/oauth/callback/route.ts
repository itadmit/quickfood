/**
 * GET /api/v1/integrations/wolt/oauth/callback
 *
 * SSIO redirect target. After the merchant consents on Wolt, their browser
 * lands here with ?code=...&state=.... We exchange the code for tokens,
 * read the venue id from the access token, and persist a WoltConnection for
 * the merchant's tenant, then bounce them back to the dashboard.
 *
 * The merchant is authenticated by their existing session cookie (they
 * started the flow from our portal), so we resolve the tenant from the
 * session rather than trusting `state`.
 */
import { handler, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { exchangeAuthorizationCode, venueIdFromAccessToken } from "@/lib/wolt/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => apiError("method_not_allowed", "use GET", 405));

export const GET = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error) return Response.redirect(dashUrl(req, `error=${encodeURIComponent(error)}`), 302);
  if (!code) return apiError("missing_code", "missing ?code", 400);

  const tokens = await exchangeAuthorizationCode(code);
  const venueId = venueIdFromAccessToken(tokens.access_token);
  if (!venueId) return apiError("no_venue", "could not resolve venue from token", 502);

  await prisma.woltConnection.upsert({
    where: { tenantId_venueId: { tenantId: session.tenantId, venueId } },
    create: {
      tenantId: session.tenantId,
      venueId,
      status: "active",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      status: "active",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return Response.redirect(dashUrl(req, "wolt=connected"), 302);
});

function dashUrl(req: Request, query: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return `${origin.replace(/\/$/, "")}/dashboard/settings/advanced?${query}`;
}
