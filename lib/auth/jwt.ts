import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const enc = new TextEncoder();

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return enc.encode(s);
}

// A till that silently loses its session stops ringing for new orders, so
// these windows are deliberately long: 30 days of access, backed by a
// 180-day refresh token. The dashboard rolls both in the background
// (SessionKeepAlive → POST /api/v1/auth/refresh), so a store that opens the
// board at least once a month is never signed out at all. Changing a user's
// role or tenant still needs them to re-login - stateless tokens can't be
// revoked mid-window.
const ACCESS_TTL = "30d";
const REFRESH_TTL = "180d";
// Short-lived proof that an email address passed OTP. Issued by the
// signup-otp/verify endpoint and consumed by the signup route - it lets the
// merchant fill the rest of step 3 (or fix a typo) without the code expiring
// out from under them, while keeping the window tight enough that a leaked
// token is near-useless.
const EMAIL_VERIFY_TTL = "15m";

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

export interface EmailVerifyClaims extends JWTPayload {
  typ: "email_verify";
  email: string; // lower-cased
}

export async function signEmailVerify(email: string): Promise<string> {
  return new SignJWT({ typ: "email_verify", email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EMAIL_VERIFY_TTL)
    .setIssuer("quickfood")
    .sign(getSecret());
}

export async function verifyEmailVerify(token: string): Promise<EmailVerifyClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: "quickfood" });
    if (payload.typ !== "email_verify" || typeof payload.email !== "string") return null;
    return payload as EmailVerifyClaims;
  } catch {
    return null;
  }
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
