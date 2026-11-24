// Deal gifts, shared by the storefront composer (preview) and order-create
// (the charge) so both always agree.
//
// Order of operations, after each item group ran its own pricing:
//   1. freeRules: per pool, the `count` cheapest PAID units whose option id
//      is in the pool cost 0. Every rule is a separate allowance, so
//      "one topping" and "one cheddar slice" don't share a slot.
//   2. freeExtras: the N cheapest remaining PAID units cost 0 (legacy,
//      deal-wide, any option).
// Size upgrades are never gifted.

export interface DealFreeRule {
  label: string;
  optionIds: string[];
  count: number;
}

export function parseDealFreeRules(raw: unknown): DealFreeRule[] {
  if (!Array.isArray(raw)) return [];
  const out: DealFreeRule[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const count = typeof o.count === "number" ? Math.floor(o.count) : 0;
    const optionIds = Array.isArray(o.optionIds)
      ? o.optionIds.filter((x): x is string => typeof x === "string")
      : [];
    if (count < 1 || optionIds.length === 0) continue;
    out.push({ label: typeof o.label === "string" ? o.label : "", optionIds, count });
  }
  return out;
}

export interface GiftablePick {
  optionId: string;
  charge: number;
  isSize?: boolean;
}

/** Indexes (into `picks`) that the deal makes free. `picks` is one entry per
 *  UNIT (an option picked 2× appears twice). */
export function dealGiftedIndexes(
  picks: GiftablePick[],
  rules: DealFreeRule[],
  freeExtras: number,
): Set<number> {
  const gifted = new Set<number>();
  const eligible = (i: number) => picks[i].charge > 0 && !picks[i].isSize && !gifted.has(i);
  const cheapestFirst = (a: number, b: number) => picks[a].charge - picks[b].charge || a - b;

  for (const rule of rules) {
    const pool = new Set(rule.optionIds);
    picks
      .map((_, i) => i)
      .filter((i) => eligible(i) && pool.has(picks[i].optionId))
      .sort(cheapestFirst)
      .slice(0, rule.count)
      .forEach((i) => gifted.add(i));
  }
  if (freeExtras > 0) {
    picks
      .map((_, i) => i)
      .filter(eligible)
      .sort(cheapestFirst)
      .slice(0, freeExtras)
      .forEach((i) => gifted.add(i));
  }
  return gifted;
}
