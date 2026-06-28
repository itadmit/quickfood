import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

export const QR_TYPES = [
  "bag",
  "sticker",
  "table_tent",
  "flyer",
  "receipt",
  "ig_bio",
  "gbp",
  "poster",
] as const;
export type QrType = (typeof QR_TYPES)[number];

export const QR_TYPE_LABELS: Record<QrType, string> = {
  bag: "מדבקה לשקית משלוח",
  sticker: "מדבקה לאריזה",
  table_tent: "שלט שולחן",
  flyer: "פלייר",
  receipt: "QR על הקבלה",
  ig_bio: "קישור באינסטגרם",
  gbp: "פרופיל עסק בגוגל",
  poster: "פוסטר בחנות",
};

export const DESTINATION_TYPES = ["menu", "signup", "loyalty", "coupon", "landing"] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];

/** Short, URL-safe, unambiguous code (no 0/O/1/l) for the /q/{code} slot. */
function genCode(len = 7): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function uniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = genCode();
    const exists = await prisma.qrCampaign.findUnique({ where: { code }, select: { id: true } });
    if (!exists) return code;
  }
  return genCode(9);
}

export interface CreateQrCampaignInput {
  tenantId: string;
  name: string;
  type: string;
  destinationType?: string;
  destinationUrl?: string | null;
  landingTemplate?: string | null;
  landingCopy?: Record<string, unknown> | null;
  couponId?: string | null;
}

export async function createQrCampaign(input: CreateQrCampaignInput) {
  const code = await uniqueCode();
  return prisma.qrCampaign.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      type: input.type,
      code,
      destinationType: input.destinationType ?? "menu",
      destinationUrl: input.destinationUrl ?? null,
      landingTemplate: input.landingTemplate ?? null,
      landingCopy: input.landingCopy ? (input.landingCopy as Prisma.InputJsonValue) : undefined,
      couponId: input.couponId ?? null,
    },
  });
}

/** Salted SHA-256 of the client IP - we never store the raw address. */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.QR_IP_SALT ?? "quickfood-growth";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export interface RecordScanInput {
  tenantId: string;
  campaignId: string;
  visitorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}

export async function recordScan(input: RecordScanInput) {
  return prisma.qrScan.create({
    data: {
      tenantId: input.tenantId,
      campaignId: input.campaignId,
      visitorId: input.visitorId ?? null,
      ipHash: hashIp(input.ip),
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      referrer: input.referrer ?? null,
    },
  });
}

/**
 * Resolve where a QR campaign forwards the scanner. ALWAYS enters the
 * storefront (never a separate page) with the ?src=qr_{code} marker that the
 * storefront persists into checkout. For `landing` campaigns the storefront
 * shows the campaign content as a one-time modal over the menu - no extra page
 * load, no navigation. The modal content is fetched by code client-side.
 */
export function resolveQrDestination(
  campaign: {
    code: string;
    destinationType: string;
    destinationUrl: string | null;
    landingTemplate: string | null;
  },
  slug: string,
): { url: string } {
  const src = `qr_${campaign.code}`;
  if (campaign.destinationUrl) {
    const sep = campaign.destinationUrl.includes("?") ? "&" : "?";
    return { url: `${campaign.destinationUrl}${sep}src=${src}` };
  }
  // The storefront home (the menu) is the INDEX at /s/{slug} - there is NO
  // /s/{slug}/menu page (it would 404), and customers have no /login route;
  // signup/loyalty are handled by the storefront's own UI. So every built-in
  // destination lands on the index with the src marker (+ join hint for
  // loyalty), which the storefront acts on.
  const join = campaign.destinationType === "loyalty" ? "&join=1" : "";
  return { url: `/s/${slug}?src=${src}${join}` };
}
