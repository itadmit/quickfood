/**
 * Per-tenant + per-device storage of the customer's chosen delivery city.
 *
 * The Wolt-style flow: the first time the customer lands on the
 * storefront we ask them where they're ordering to. We persist the
 * choice in localStorage so they don't see the picker every visit, and
 * surface a "change" affordance in the top bar.
 *
 * `null` (or no entry) means the customer hasn't answered yet. Once
 * they answer, value is either:
 *   - a city name (delivery to that city)
 *   - the sentinel "__pickup__" (they chose to come pick up - no
 *     coverage needed)
 */

const KEY_PREFIX = "qf:delivery-city:";
const PICKUP_SENTINEL = "__pickup__";

function key(tenantSlug: string) {
  return `${KEY_PREFIX}${tenantSlug}`;
}

export type DeliveryChoice =
  | { kind: "delivery"; city: string }
  | { kind: "pickup" }
  | null;

export function readDeliveryChoice(tenantSlug: string): DeliveryChoice {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(tenantSlug));
    if (!raw) return null;
    if (raw === PICKUP_SENTINEL) return { kind: "pickup" };
    return { kind: "delivery", city: raw };
  } catch {
    return null;
  }
}

export function writeDeliveryChoice(tenantSlug: string, choice: DeliveryChoice): void {
  if (typeof window === "undefined") return;
  try {
    if (!choice) {
      window.localStorage.removeItem(key(tenantSlug));
      return;
    }
    const value = choice.kind === "pickup" ? PICKUP_SENTINEL : choice.city;
    window.localStorage.setItem(key(tenantSlug), value);
  } catch {
    /* ignore */
  }
}
