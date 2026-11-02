import { createHmac, timingSafeEqual } from "node:crypto";

function signature(payload: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET is required");
  return createHmac("sha256", secret).update(`purchase-pixel:${payload}`).digest();
}

export function purchaseToken(orderId: string) {
  const payload = Buffer.from(JSON.stringify({ orderId, exp: Date.now() + 86400000 })).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function verifyPurchaseToken(token: string, orderId: string) {
  try {
    const [payload, sig] = token.split(".");
    const received = Buffer.from(sig, "base64url");
    const expected = signature(payload);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.orderId === orderId && typeof data.exp === "number" && data.exp > Date.now();
  } catch { return false; }
}
