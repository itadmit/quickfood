import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const enc = new TextEncoder();

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return enc.encode(s);
}

// Access TTL bumped from 15m → 7d to match the cookie max-age, since
// we don't yet have a refresh endpoint that would roll a new access
// token before this expires. With both at 7d the user stays signed in
// for a full week; the 30-day refresh cookie still backs it up for
// when we wire `/api/v1/auth/refresh`.
const ACCESS_TTL = "7d";
const REFRESH_TTL = "30d";

export interface AccessClaims extends JWTPayload {
  sub: string; // user id (customer or merchant)
  typ: "customer" | "merchant";
  role?: string; // merchant only
  tid?: string; // tenant id (merchant only)
}

export interface RefreshClaims extends JWTPayload {
  sub: string;
  typ: "customer" | "merchant";
  jti: string;
}

export async function signAccess(claims: Omit<AccessClaims, "iat" | "exp">): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .setIssuer("quickfood")
    .sign(getSecret());
}

export async function signRefresh(
  claims: Omit<RefreshClaims, "iat" | "exp" | "jti"> & { jti?: string },
): Promise<string> {
  const jti = claims.jti ?? crypto.randomUUID();
  return new SignJWT({ ...claims, jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .setIssuer("quickfood")
    .sign(getSecret());
}

export async function verifyAccess(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: "quickfood" });
    return payload as AccessClaims;
  } catch {
    return null;
  }
}

export async function verifyRefresh(token: string): Promise<RefreshClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: "quickfood" });
    return payload as RefreshClaims;
  } catch {
    return null;
  }
}
