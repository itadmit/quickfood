import crypto from "node:crypto";
import { woltConfig } from "./config";

// Wolt signs the order webhook body with HMAC-SHA256 using the client secret
// we submitted in the integration form. We verify against the RAW request
// body (not a re-serialized object - JSON key order would change the hash).
//
// TODO(sandbox): confirm the exact header name Wolt sends the signature in.
// The form labels it generically; common choices are x-wolt-signature /
// x-wolt-hmac-sha256. We accept any of the candidates below.
const SIGNATURE_HEADERS = [
  "x-wolt-signature",
  "x-wolt-hmac-sha256",
  "wolt-signature",
];

export function readSignatureHeader(headers: Headers): string | null {
  for (const h of SIGNATURE_HEADERS) {
    const v = headers.get(h);
    if (v) return v.trim();
  }
  return null;
}

export function verifyWoltSignature(rawBody: string, signature: string | null): boolean {
  if (!woltConfig.webhookSecret) return false;
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", woltConfig.webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  // Some providers send base64 instead of hex; compute both and compare.
  const expectedB64 = Buffer.from(expected, "hex").toString("base64");
  const candidate = signature.replace(/^sha256=/i, "").trim();

  return timingSafeEqual(candidate, expected) || timingSafeEqual(candidate, expectedB64);
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
