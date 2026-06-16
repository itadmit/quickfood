import { prisma } from "@/lib/db/client";
import { woltConfig, assertWoltConfigured } from "./config";
import type { WoltTokenResponse } from "./types";

// SSIO OAuth 2.0 token handling.
// https://developer.wolt.com/docs/authentication20
//   - access token  ~1h  (Bearer on every API call)
//   - refresh token ~30d, SINGLE USE  (must persist the new one each refresh)
// The venue id is carried in the access token's `integration.venue_id` claim.

function basicAuthHeader(): string {
  const raw = `${woltConfig.clientId}:${woltConfig.clientSecret}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function tokenRequest(body: URLSearchParams): Promise<WoltTokenResponse> {
  assertWoltConfigured();
  const res = await fetch(woltConfig.tokenUrl, {
    method: "POST",
    headers: {
      authorization: basicAuthHeader(),
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Wolt token request failed (${res.status}): ${text}`);
  }
  return (await res.json()) as WoltTokenResponse;
}

export function exchangeAuthorizationCode(code: string): Promise<WoltTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: woltConfig.redirectUri,
    }),
  );
}

export function refreshTokens(refreshToken: string): Promise<WoltTokenResponse> {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

/** Pull the venue id out of the access token's integration claim. */
export function venueIdFromAccessToken(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return json?.integration?.venue_id ?? json?.venue_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Return a non-expired access token for a tenant's Wolt connection,
 * refreshing (and persisting the rotated refresh token) when needed.
 * Throws if the tenant has no active connection.
 */
export async function getValidAccessToken(tenantId: string): Promise<{ accessToken: string; venueId: string }> {
  const conn = await prisma.woltConnection.findFirst({
    where: { tenantId, status: "active" },
  });
  if (!conn) throw new Error(`No active Wolt connection for tenant ${tenantId}`);

  const stillValid =
    conn.accessToken &&
    conn.tokenExpiresAt &&
    conn.tokenExpiresAt.getTime() - Date.now() > 60_000; // 60s safety margin

  if (stillValid) {
    return { accessToken: conn.accessToken!, venueId: conn.venueId };
  }

  if (!conn.refreshToken) throw new Error(`Wolt connection ${conn.id} has no refresh token`);

  const tokens = await refreshTokens(conn.refreshToken);
  await prisma.woltConnection.update({
    where: { id: conn.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });
  return { accessToken: tokens.access_token, venueId: conn.venueId };
}
