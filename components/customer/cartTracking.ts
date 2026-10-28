import { sfTrack } from "@/lib/fb/storefront";
import type { CartLine } from "./CartProvider";

/**
 * Fire the store pixel `AddToCart` event AND bump the first-party add-to-cart
 * counter (powers the dashboard "הוספות לסל" metric). Called from
 * `CartProvider.add` so every single add is captured once, whatever the entry
 * point (menu / size upsell / AI advisor / deal). Both legs are best-effort
 * and must never disrupt the cart.
 */
export function trackCartAdd(tenantSlug: string, line: Omit<CartLine, "lineId">) {
  const optionsTotal = line.options.reduce((a, o) => a + o.priceDelta, 0);
  const unit = line.basePrice + line.sizeDelta + optionsTotal;
  const value = Math.max(0, unit) * Math.max(1, line.quantity);

  sfTrack("AddToCart", {
    content_type: "product",
    content_ids: [line.itemId],
    content_name: line.name,
    contents: [{ id: line.itemId, quantity: line.quantity }],
    value,
    currency: "ILS",
  });

  try {
    void fetch("/api/v1/public/track-cart-add", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* tracking must never disrupt the cart */
  }
}
