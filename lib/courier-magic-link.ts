import { prisma } from "@/lib/db/client";
import { generateRawToken, hashToken } from "@/lib/auth/courier-session";

export const COURIER_MAGIC_LINK_TTL_MINUTES = 60;

/**
 * Mint a single-use magic-link token for a courier and return the
 * absolute verify URL the merchant can hand to them. Same shape as the
 * /merchant/couriers/[id]/magic-link endpoint - extracted so callers
 * (e.g. the welcome email on courier creation) don't have to round-trip
 * through that route.
 */
export async function createCourierMagicLink(
  courierId: string,
  baseUrl: string,
  ttlMinutes: number = COURIER_MAGIC_LINK_TTL_MINUTES,
): Promise<{ url: string; expiresAt: Date; ttlMinutes: number }> {
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await prisma.courierMagicLinkToken.create({
    data: { courierId, tokenHash, expiresAt },
  });
  const origin = baseUrl.replace(/\/$/, "");
  const url = `${origin}/courier/login/verify?token=${encodeURIComponent(raw)}`;
  return { url, expiresAt, ttlMinutes };
}
