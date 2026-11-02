/** Compare-at prices are display metadata, never an input to charges or discounts. */
export function originalPrice(current: number, base: number, compareAt?: number | null): number | null {
  return compareAt != null && Number.isFinite(compareAt) && compareAt > base
    ? current + compareAt - base : null;
}

/** Freeze both values before rounding so fractional modifiers and quantities stay accurate. */
export function comparisonSnapshot(currentUnit: number, base: number, compareAt: number | null, quantity: number) {
  const original = originalPrice(currentUnit, base, compareAt);
  return {
    originalUnitPrice: original == null ? null : Math.round(original),
    originalTotalPrice: original == null ? null : Math.round(original * quantity),
  };
}
