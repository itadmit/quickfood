import crypto from "node:crypto";

const DEFAULT_TTL_DAYS = 90;

function getSecret(): string {
  const s = process.env.REVIEW_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error("REVIEW_TOKEN_SECRET (or JWT_SECRET) must be set and at least 32 characters");
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function hmac(payload: string): string {
  return b64url(crypto.createHmac("sha256", getSecret()).update(payload).digest());
}

export function signReviewToken(orderId: string, ttlDays: number = DEFAULT_TTL_DAYS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;
  const payload = b64url(Buffer.from(JSON.stringify({ o: orderId, e: exp })));
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export function verifyReviewToken(token: string | null | undefined): { orderId: string } | null {
  if (!token || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(payload);
  const sigBuf = fromB64url(sig);
  const expBuf = fromB64url(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const parsed = JSON.parse(fromB64url(payload).toString()) as { o?: unknown; e?: unknown };
    if (typeof parsed.o !== "string" || typeof parsed.e !== "number") return null;
    if (parsed.e < Math.floor(Date.now() / 1000)) return null;
    return { orderId: parsed.o };
  } catch {
    return null;
  }
}
