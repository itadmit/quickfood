/**
 * Automatic free gift above a cart amount ("מנה מתנה מעל 150 ₪").
 *
 * Pure logic shared by the storefront cart (display) and createOrder (the
 * authority). No DB access here, so the cart can import it and the tests can
 * exercise it without a database.
 *
 * Rules:
 *  - The threshold is measured on the item subtotal (regular lines + deals),
 *    before discounts, without delivery and without the gift itself.
 *  - A rule counts only while active and inside its optional time window.
 *  - Several rules act as tiers: the highest threshold the cart reaches wins,
 *    and the order gets exactly ONE gift unit. Never more, whatever the client
 *    sends.
 */

export interface FreeGiftRuleLike {
  id: string;
  itemId: string;
  minSubtotal: number;
  active: boolean;
  validFrom?: Date | string | null;
  validUntil?: Date | string | null;
}

/** Suffix appended to the gift line's name snapshot, so the kitchen ticket,
 *  the POS queue, receipts and emails all say "מתנה" with no per-screen code. */
export const FREE_GIFT_LABEL = "מתנה";

function toTime(v: Date | string | null | undefined): number | null {
  if (v == null) return null;
  const t = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export function isGiftRuleLive(rule: FreeGiftRuleLike, now: Date): boolean {
  if (!rule.active || !(rule.minSubtotal > 0)) return false;
  const from = toTime(rule.validFrom);
  const until = toTime(rule.validUntil);
  const t = now.getTime();
  if (from !== null && t < from) return false;
  if (until !== null && t > until) return false;
  return true;
}

/** The rule whose gift the cart earns right now, or null. */
export function pickGiftRule<R extends FreeGiftRuleLike>(
  rules: readonly R[],
  subtotal: number,
  now: Date,
): R | null {
  let best: R | null = null;
  for (const r of rules) {
    if (!isGiftRuleLive(r, now) || subtotal < r.minSubtotal) continue;
    if (!best || r.minSubtotal > best.minSubtotal) best = r;
  }
  return best;
}

/** The next tier the cart has not reached yet (for "עוד X ₪ למתנה"), or null. */
export function nextGiftRule<R extends FreeGiftRuleLike>(
  rules: readonly R[],
  subtotal: number,
  now: Date,
): R | null {
  let next: R | null = null;
  for (const r of rules) {
    if (!isGiftRuleLive(r, now) || subtotal >= r.minSubtotal) continue;
    if (!next || r.minSubtotal < next.minSubtotal) next = r;
  }
  return next;
}

export function giftLineName(itemName: string): string {
  return `${itemName} (${FREE_GIFT_LABEL})`;
}
