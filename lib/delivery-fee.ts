/**
 * Single source of truth for the delivery-fee calculation, shared by the
 * server (order creation) and the customer cart UI so the price the
 * customer sees always equals the price they're charged.
 *
 * Free delivery is waived when the cart meets EITHER threshold (subtotal
 * or item count). A null/0 threshold means that rule is off.
 */
export function computeDeliveryFee(opts: {
  method: "delivery" | "pickup";
  baseFee: number;
  subtotal: number;
  itemCount: number;
  freeMinOrder: number | null | undefined;
  freeMinItems: number | null | undefined;
}): number {
  if (opts.method !== "delivery") return 0;
  if (opts.baseFee <= 0) return 0;
  const freeByOrder =
    opts.freeMinOrder != null && opts.freeMinOrder > 0 && opts.subtotal >= opts.freeMinOrder;
  const freeByItems =
    opts.freeMinItems != null && opts.freeMinItems > 0 && opts.itemCount >= opts.freeMinItems;
  return freeByOrder || freeByItems ? 0 : opts.baseFee;
}
