/**
 * Server-side check for whether a MenuItem is currently visible to
 * customers, given its time-windowing fields and inventory countdown.
 *
 * Rules:
 *   1. `available` must be true (the boring on/off toggle).
 *   2. `stockRemaining`, if set, must be > 0.
 *   3. If both `availableFrom` and `availableTo` are set, the current
 *      time-of-day (in MINUTES SINCE MIDNIGHT) must fall in [from, to).
 *      If from > to, the window wraps midnight (e.g. 22:00–02:00).
 *      Either one set alone with the other null = no time restriction
 *      (a half-defined window is treated as merchant intent in progress).
 *   4. `availableDays`, if set, is a 7-bit weekday mask (bit 0 = Sunday).
 *      Current day must be ON in the mask.
 *
 * Time zone: we use the SERVER's local clock. Tenants are Israel-only
 * for now so this matches the merchant's clock; we can swap to a tenant-
 * level timezone later by reading it from settings.
 */

export interface AvailabilityFields {
  available: boolean;
  availableFrom: number | null;
  availableTo: number | null;
  availableDays: number | null;
  stockRemaining: number | null;
}

export function isItemVisibleNow(item: AvailabilityFields, now: Date = new Date()): boolean {
  if (!item.available) return false;
  if (item.stockRemaining !== null && item.stockRemaining <= 0) return false;

  // Weekday mask check.
  if (item.availableDays !== null) {
    const dayBit = 1 << now.getDay();
    if ((item.availableDays & dayBit) === 0) return false;
  }

  // Time-of-day check - only enforced when BOTH ends are set.
  if (item.availableFrom !== null && item.availableTo !== null) {
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const from = item.availableFrom;
    const to = item.availableTo;
    if (from < to) {
      // Normal window: 09:00 → 17:00
      if (minutesNow < from || minutesNow >= to) return false;
    } else if (from > to) {
      // Wraps midnight: 22:00 → 02:00 - visible if late-night OR early-morning
      if (minutesNow < from && minutesNow >= to) return false;
    }
    // from === to is a zero-length window - interpret as "always" (merchant
    // probably hasn't finished setting it up).
  }

  return true;
}
