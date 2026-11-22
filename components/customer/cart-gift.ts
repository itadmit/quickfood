import { nextGiftRule, pickGiftRule, type FreeGiftRuleLike } from "@/lib/free-gift";

/** A gift rule as the storefront receives it (layout → CartProvider). */
export interface StorefrontGiftRule extends FreeGiftRuleLike {
  item: { id: string; name: string; imageUrl: string | null };
}

/** The gift the cart shows. It is derived from the lines on every render and
 *  never stored as a cart line, so the customer cannot change its quantity,
 *  edit it, or carry it into checkout below the threshold. The server adds
 *  the real line on its own at order time. */
export interface CartGift {
  ruleId: string;
  itemId: string;
  name: string;
  imageUrl: string | null;
  minSubtotal: number;
  price: 0;
  quantity: 1;
}

export interface CartGiftNext {
  ruleId: string;
  itemName: string;
  minSubtotal: number;
  missing: number;
}

interface PricedLine {
  basePrice: number;
  sizeDelta: number;
  options: Array<{ priceDelta: number }>;
  quantity: number;
}

export function deriveCartGift(
  rules: readonly StorefrontGiftRule[],
  lines: readonly PricedLine[],
  now: Date = new Date(),
): { gift: CartGift | null; next: CartGiftNext | null } {
  if (rules.length === 0 || lines.length === 0) return { gift: null, next: null };
  // Same formula as the cart subtotal: items + deals, no delivery, no gift.
  const subtotal = lines.reduce(
    (acc, l) => acc + (l.basePrice + l.sizeDelta + l.options.reduce((a, o) => a + o.priceDelta, 0)) * l.quantity,
    0,
  );
  const r = pickGiftRule(rules, subtotal, now);
  const n = nextGiftRule(rules, subtotal, now);
  return {
    gift: r
      ? { ruleId: r.id, itemId: r.item.id, name: r.item.name, imageUrl: r.item.imageUrl, minSubtotal: r.minSubtotal, price: 0, quantity: 1 }
      : null,
    next: n
      ? { ruleId: n.id, itemName: n.item.name, minSubtotal: n.minSubtotal, missing: Math.max(0, Math.ceil(n.minSubtotal - subtotal)) }
      : null,
  };
}
