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
 * Time zone: Israel wall clock (Asia/Jerusalem), the same clock the branch
 * opening hours use. Vercel functions run in UTC, so the runtime's
 * getHours()/getDay() would shift every window by 2-3 hours. Tenants are
 * Israel-only for now; a tenant-level timezone can replace this later.
 */

import { israelWallClock } from "@/lib/branch-hours";

export interface AvailabilityFields {
  available: boolean;
  availableFrom: number | null;
  availableTo: number | null;
  availableDays: number | null;
  stockRemaining: number | null;
}

export interface CategoryAvailabilityFields {
  active: boolean;
  availableFrom: number | null;
  availableTo: number | null;
  availableDays: number | null;
}

export interface DealAvailabilityFields {
  active: boolean;
  availableFrom: number | null;
  availableTo: number | null;
  availableDays: number | null;
}

/**
 * Whether a deal is currently offered to customers: the deals rail, its
 * category placement, the composer and order creation all go through this.
 * Same day/hour windowing as items; NULL fields = always (legacy deals).
 */
export function isDealVisibleNow(
  deal: DealAvailabilityFields,
  now: Date = new Date(),
): boolean {
  return isItemVisibleNow(
    {
      available: deal.active,
      availableFrom: deal.availableFrom,
      availableTo: deal.availableTo,
      availableDays: deal.availableDays,
      stockRemaining: null,
    },
    now,
  );
}

/**
 * Whether a category is currently shown to customers. Same time/day windowing
 * as items (reuses isItemVisibleNow); `active` maps to `available` and there's
 * no stock concept for a category.
 */
export function isCategoryVisibleNow(
  cat: CategoryAvailabilityFields,
  now: Date = new Date(),
): boolean {
  return isItemVisibleNow(
    {
      available: cat.active,
      availableFrom: cat.availableFrom,
      availableTo: cat.availableTo,
      availableDays: cat.availableDays,
      stockRemaining: null,
    },
    now,
  );
}

export function isItemVisibleNow(item: AvailabilityFields, now: Date = new Date()): boolean {
  if (!item.available) return false;
  if (item.stockRemaining !== null && item.stockRemaining <= 0) return false;

  const clock = israelWallClock(now);

  // Weekday mask check.
  if (item.availableDays !== null) {
    const dayBit = 1 << clock.weekday;
    if ((item.availableDays & dayBit) === 0) return false;
  }

  // Time-of-day check - only enforced when BOTH ends are set.
  if (item.availableFrom !== null && item.availableTo !== null) {
    const minutesNow = clock.minutes;
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
