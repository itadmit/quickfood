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
 * Resolve where a QR campaign should forward the scanner. Returns either a
 * landing page (rendered before the menu) or a final redirect URL with the
 * ?src=qr_{code} marker that the storefront persists into checkout.
 */
export function resolveQrDestination(
  campaign: {
    code: string;
    destinationType: string;
    destinationUrl: string | null;
    landingTemplate: string | null;
  },
  slug: string,
): { kind: "landing" | "redirect"; url: string } {
  const src = `qr_${campaign.code}`;
  if (campaign.destinationType === "landing" && campaign.landingTemplate) {
    return { kind: "landing", url: `/r/${slug}/q/${campaign.code}/welcome` };
  }
  if (campaign.destinationUrl) {
    const sep = campaign.destinationUrl.includes("?") ? "&" : "?";
    return { kind: "redirect", url: `${campaign.destinationUrl}${sep}src=${src}` };
  }
  const path =
    campaign.destinationType === "signup"
      ? "/login"
      : campaign.destinationType === "loyalty"
        ? "/menu?join=1"
        : "/menu";
  return { kind: "redirect", url: `/s/${slug}${path}?src=${src}` };
}
