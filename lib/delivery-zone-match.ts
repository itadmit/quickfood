/**
 * Resolve which delivery zone a customer's city falls into. Shared by the
 * client cart (display) and the server order path (authoritative charge) so
 * the fee/minimum the customer sees equals what they're charged.
 *
 * A zone's `cities` list is the source of truth; when empty we fall back to
 * matching the zone name (mirrors the storefront city-picker logic). Matching
 * is case-insensitive and whitespace-normalized.
 *
 * A `nationwide` zone is a catch-all: it matches ANY city and is returned as
 * the fallback when no city-specific zone matches, so a store can deliver to
 * any address at a flat fee alongside its regular city zones.
 */
export interface ZoneForMatch {
  name: string;
  cities: string[];
  nationwide: boolean;
  deliveryFee: number;
  minOrder: number;
  freeDeliveryAbove: number | null;
  minEta: number;
  maxEta: number;
}

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLocaleLowerCase("he-IL");
}

export function matchZoneByCity<T extends ZoneForMatch>(
  zones: T[],
  city: string | null | undefined,
): T | null {
  if (!city) return null;
  const target = norm(city);
  if (!target) return null;
  // Specific city zones win over the nationwide catch-all.
  for (const z of zones) {
    if (z.nationwide) continue;
    const list = z.cities.length > 0 ? z.cities : [z.name];
    if (list.some((c) => norm(c) === target)) return z;
  }
  // No city match - fall back to a nationwide zone if the store has one.
  return zones.find((z) => z.nationwide) ?? null;
}

/** True when the store delivers to any address (has an active nationwide zone). */
export function hasNationwideZone(zones: { nationwide: boolean }[]): boolean {
  return zones.some((z) => z.nationwide);
}
