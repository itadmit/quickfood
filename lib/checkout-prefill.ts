/**
 * sessionStorage handoff for the "הזמן שוב" → /checkout flow.
 *
 * When the customer taps "reorder" on the home rail we save the
 * checkout fields from the past order into sessionStorage, then redirect
 * them to /cart → /checkout. The checkout screen reads the payload on
 * mount and clears the key so refreshing the page doesn't keep replaying
 * the same prefill.
 *
 * sessionStorage (not localStorage) on purpose: it auto-clears when the
 * tab closes, so we don't hand back week-old details forever.
 */

const KEY_PREFIX = "qf:checkout-prefill:";

export interface CheckoutPrefill {
  firstName?: string;
  lastName?: string;
  phone?: string;
  method?: "delivery" | "pickup";
  paymentMethod?: "cash" | "card" | "bit" | "apple_pay" | "google_pay";
  tip?: number;
  customerNotes?: string;
  address?: string;
  floor?: string;
  deliveryNotes?: string;
}

function key(tenantSlug: string) {
  return `${KEY_PREFIX}${tenantSlug}`;
}

export function saveCheckoutPrefill(tenantSlug: string, data: CheckoutPrefill): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key(tenantSlug), JSON.stringify(data));
  } catch {
    /* sessionStorage unavailable */
  }
}

/**
 * Read + clear the prefill. Always clears so the next render or refresh
 * doesn't double-apply.
 */
export function takeCheckoutPrefill(tenantSlug: string): CheckoutPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key(tenantSlug));
    if (!raw) return null;
    window.sessionStorage.removeItem(key(tenantSlug));
    const parsed = JSON.parse(raw) as CheckoutPrefill;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Split the joined Order.deliveryNotes ("address · קומה N · notes") back
 * into the three checkout fields. Mirrors the join logic in
 * CustomerCheckout.place() — keep the two in sync.
 */
export function splitDeliveryNotes(
  raw: string | null | undefined,
): { address: string; floor: string; notes: string } {
  if (!raw) return { address: "", floor: "", notes: "" };
  const parts = raw
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
  let address = "";
  let floor = "";
  const notesParts: string[] = [];
  for (const part of parts) {
    if (!address) {
      address = part;
      continue;
    }
    if (!floor && part.startsWith("קומה ")) {
      floor = part.slice("קומה ".length).trim();
      continue;
    }
    notesParts.push(part);
  }
  return { address, floor, notes: notesParts.join(" · ") };
}
