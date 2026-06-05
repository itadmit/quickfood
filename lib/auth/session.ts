import { cookies } from "next/headers";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { verifyAccess, signAccess, signRefresh, verifyRefresh, type AccessClaims } from "./jwt";
import { prisma } from "@/lib/db/client";

export const ACCESS_COOKIE = "qf_access";
export const REFRESH_COOKIE = "qf_refresh";

const isProd = process.env.NODE_ENV === "production";

export interface Session {
  type: "customer" | "merchant";
  userId: string;
  role?: string;
  tenantId?: string;
  via: "cookie" | "bearer" | "api_key";
}

/**
 * Read the active session from cookies, Authorization: Bearer JWT, or API key.
 * Returns null if none / invalid.
 */
export async function getSession(): Promise<Session | null> {
  const hdrs = await headers();
  const auth = hdrs.get("authorization") || hdrs.get("Authorization");

  // 1. API key (qfk_...)
  if (auth?.startsWith("Bearer qfk_")) {
    const token = auth.slice("Bearer ".length);
    const found = await findApiKey(token);
    if (found) {
      if (found.customerId) {
        return { type: "customer", userId: found.customerId, via: "api_key" };
      }
      if (found.tenantId) {
        return {
          type: "merchant",
          userId: "api_key:" + found.id,
          role: "api",
          tenantId: found.tenantId,
          via: "api_key",
        };
      }
    }
  }

  // 2. Bearer JWT (mobile / SDK)
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length);
    const claims = await verifyAccess(token);
    if (claims) return claimsToSession(claims, "bearer");
  }

  // 3. Cookie (web)
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  if (access) {
    const claims = await verifyAccess(access);
    if (claims) return claimsToSession(claims, "cookie");
  }

  return null;
}

function claimsToSession(c: AccessClaims, via: Session["via"]): Session {
  return {
    type: c.typ,
    userId: c.sub,
    role: c.role,
    tenantId: c.tid,
    via,
  };
}

export async function setSessionCookies(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const jar = await cookies();
  // 7-day access cookie - was 15min, which logged the user out every
  // quarter hour because we don't have a /api/v1/auth/refresh route
  // or a middleware that rolls the access token from the refresh
  // cookie. Until that's wired, a longer-lived access cookie stops
  // the constant disconnects. The refresh cookie still backs it up
  // for 30 days. TODO: add a refresh endpoint + return to 15min.
  jar.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  jar.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/api/v1/auth",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function issueTokensForCustomer(customerId: string) {
  const accessToken = await signAccess({ sub: customerId, typ: "customer" });
  const refreshToken = await signRefresh({ sub: customerId, typ: "customer" });
  return { accessToken, refreshToken };
}

export async function issueTokensForMerchant(
  userId: string,
  tenantId: string | null,
  role: string,
) {
  const accessToken = await signAccess({
    sub: userId,
    typ: "merchant",
    role,
    tid: tenantId ?? undefined,
  });
  const refreshToken = await signRefresh({ sub: userId, typ: "merchant" });
  return { accessToken, refreshToken };
}

export { verifyRefresh };

// ─── API Key lookup ────────────────────────────────────────────
// qfk_<prefix>_<secret>  ← hash(secret) matches stored hash.
async function findApiKey(raw: string) {
  if (!raw.startsWith("qfk_")) return null;
  const rest = raw.slice(4);
  const sep = rest.indexOf("_");
  if (sep < 0) return null;
  const prefix = rest.slice(0, sep);
  const secret = rest.slice(sep + 1);
  const candidates = await prisma.apiKey.findMany({
    where: {
      prefix,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    select: { id: true, hash: true, tenantId: true, customerId: true },
  });
  for (const c of candidates) {
    if (await bcrypt.compare(secret, c.hash)) {
      void prisma.apiKey.update({
        where: { id: c.id },
        data: { lastUsedAt: new Date() },
      });
      return c;
    }
  }
  return null;
}
