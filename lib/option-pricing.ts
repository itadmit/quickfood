export type OptionPlacement = "left" | "right" | "full";

export interface PricedOption {
  id: string;
  priceDelta: number;
  half?: OptionPlacement | null;
}

export interface GroupPricingConfig {
  includedFree?: number;
  bundleCount?: number;
  bundlePrice?: number;
  splitPrice?: boolean;
}

// Single source of truth for per-option add-on pricing inside one group.
// Returns a map of optionId -> effective price delta. Used by the cart
// (client), the POS, and the order-create server path so all three agree.
//
// Rules, in priority order:
//   1. Bundle deal ("X בחירות ראשונות ב-Y"): when bundleCount > 0, the first
//      `bundleCount` cheapest paid picks share a flat cap of `bundlePrice`
//      total (each consumes up to the remaining cap, never more than its own
//      delta). Picks beyond the bundle pay full price. No repeat / no stacking.
//      includedFree is ignored while a bundle is active.
//   2. Otherwise includedFree: the cheapest `includedFree` paid picks are free.
//   3. splitPrice only matters for half/half placements outside the bundle:
//      a non-"full" placement halves that pick's charge. Bundle picks are
//      charged via the cap and are never additionally halved.
export function priceGroupOptions(
  picks: PricedOption[],
  cfg: GroupPricingConfig,
): Map<string, number> {
  const includedFree = cfg.includedFree ?? 0;
  const bundleCount = cfg.bundleCount ?? 0;
  const bundlePrice = cfg.bundlePrice ?? 0;
  const split = cfg.splitPrice ?? false;

  const withHalf = (p: PricedOption, base: number) =>
    p.half && p.half !== "full" && split ? base / 2 : base;

  const out = new Map<string, number>();
  const paid = picks
    .filter((p) => p.priceDelta > 0)
    .sort((a, b) => a.priceDelta - b.priceDelta);
  const rest = picks.filter((p) => p.priceDelta <= 0);

  if (bundleCount > 0) {
    let cap = bundlePrice;
    paid.forEach((p, i) => {
      if (i < bundleCount) {
        const charge = Math.min(p.priceDelta, cap);
        cap -= charge;
        out.set(p.id, charge);
      } else {
        out.set(p.id, withHalf(p, p.priceDelta));
      }
    });
  } else {
    paid.forEach((p, i) => {
      const base = i < includedFree ? 0 : p.priceDelta;
      out.set(p.id, withHalf(p, base));
    });
  }

  for (const p of rest) out.set(p.id, withHalf(p, p.priceDelta));
  return out;
}
