import { prisma } from "@/lib/db/client";
import type { AttributionCategory } from "@prisma/client";

export type SourceCategory = AttributionCategory;

export interface SourceDef {
  key: string;
  label: string;
  category: SourceCategory;
}

// Per-country "how did you hear about us" defaults. The merchant can edit /
// reorder / disable these from Growth → Customer Sources; the seed only runs
// once per tenant (first time the source list is read).
const DEFAULTS: Record<string, SourceDef[]> = {
  IL: [
    { key: "wolt", label: "וולט", category: "marketplace" },
    { key: "tenbis", label: "תן ביס", category: "marketplace" },
    { key: "google", label: "גוגל", category: "search" },
    { key: "instagram", label: "אינסטגרם", category: "social" },
    { key: "facebook", label: "פייסבוק", category: "social" },
    { key: "tiktok", label: "טיקטוק", category: "social" },
    { key: "referral", label: "חבר/ה המליצו", category: "referral" },
    { key: "walk_in", label: "עברתי ליד / ישבתי במקום", category: "walk_in" },
    { key: "flyer", label: "פלייר / מדבקה / QR", category: "qr" },
    { key: "returning", label: "לקוח/ה חוזר/ת", category: "other" },
    { key: "other", label: "אחר", category: "other" },
  ],
  JP: [
    { key: "ubereats", label: "Uber Eats", category: "marketplace" },
    { key: "demaecan", label: "Demae-can", category: "marketplace" },
    { key: "menu", label: "menu", category: "marketplace" },
    { key: "google", label: "Google", category: "search" },
    { key: "instagram", label: "Instagram", category: "social" },
    { key: "line", label: "LINE", category: "social" },
    { key: "tiktok", label: "TikTok", category: "social" },
    { key: "walk_in", label: "Walk-in", category: "walk_in" },
    { key: "referral", label: "Referral", category: "referral" },
    { key: "other", label: "Other", category: "other" },
  ],
};

export function defaultSourcesFor(country: string): SourceDef[] {
  return DEFAULTS[country?.toUpperCase()] ?? DEFAULTS.IL;
}

export interface TenantSource {
  id: string;
  sourceKey: string;
  sourceLabel: string;
  sourceCategory: SourceCategory;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Returns the tenant's configurable source list, seeding the country defaults
 * on first read. Used both by the checkout attribution prompt (active only)
 * and the Growth → Customer Sources editor (all).
 */
export async function getSourcesForTenant(
  tenantId: string,
  country = "IL",
  opts: { activeOnly?: boolean } = {},
): Promise<TenantSource[]> {
  let rows = await prisma.sourceSetting.findMany({
    where: { tenantId, ...(opts.activeOnly ? { isActive: true } : {}) },
    orderBy: { sortOrder: "asc" },
  });

  if (rows.length === 0) {
    const defaults = defaultSourcesFor(country);
    await prisma.sourceSetting.createMany({
      data: defaults.map((s, i) => ({
        tenantId,
        country: country.toUpperCase(),
        sourceKey: s.key,
        sourceLabel: s.label,
        sourceCategory: s.category,
        sortOrder: i,
      })),
      skipDuplicates: true,
    });
    rows = await prisma.sourceSetting.findMany({
      where: { tenantId, ...(opts.activeOnly ? { isActive: true } : {}) },
      orderBy: { sortOrder: "asc" },
    });
  }

  return rows.map((r) => ({
    id: r.id,
    sourceKey: r.sourceKey,
    sourceLabel: r.sourceLabel,
    sourceCategory: r.sourceCategory,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  }));
}

/** Look up the category for a known source key (defaults to "other"). */
export async function categoryForSource(
  tenantId: string,
  sourceKey: string,
): Promise<SourceCategory> {
  const row = await prisma.sourceSetting.findUnique({
    where: { tenantId_sourceKey: { tenantId, sourceKey } },
    select: { sourceCategory: true },
  });
  return row?.sourceCategory ?? "other";
}
