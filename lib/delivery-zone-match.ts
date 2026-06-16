/**
 * Resolve which delivery zone a customer's city falls into. Shared by the
 * client cart (display) and the server order path (authoritative charge) so
 * the fee/minimum the customer sees equals what they're charged.
 *
 * A zone's `cities` list is the source of truth; when empty we fall back to
 * matching the zone name (mirrors the storefront city-picker logic). Matching
 * is case-insensitive and whitespace-normalized.
 */
export interface ZoneForMatch {
  name: string;
  cities: string[];
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
  for (const z of zones) {
    const list = z.cities.length > 0 ? z.cities : [z.name];
    if (list.some((c) => norm(c) === target)) return z;
  }
  return null;
}
