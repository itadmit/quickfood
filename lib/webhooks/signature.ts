import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sign a webhook payload using HMAC-SHA256.
 *
 * Header format (Stripe-style):
 *   X-QuickFood-Signature: t=<unix>,v1=<hex>
 */
export function signPayload(
  secret: string,
  body: string,
  timestamp: number = Math.floor(Date.now() / 1000),
): { header: string; timestamp: number; v1: string } {
  const signedPayload = `${timestamp}.${body}`;
  const v1 = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return {
    header: `t=${timestamp},v1=${v1}`,
    timestamp,
    v1,
  };
}

/**
 * Verify a signed payload. Returns true if the signature matches and is within tolerance.
 *
 * Verification reference for receivers — also used by our own tests.
 */
export function verifySignature(opts: {
  secret: string;
  body: string;
  header: string;
  toleranceSeconds?: number;
}): boolean {
  const { secret, body, header, toleranceSeconds = 300 } = opts;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string]),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  if (expected.length !== v1.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

export function newWebhookSecret(): string {
  // 32 bytes hex ← 64 chars
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
