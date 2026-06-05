/**
 * Client-side store for guest customers' recent order ids. Logged-in
 * customers don't need this - the server fetches their orders by
 * customer id - but guests have no persistent identity, so we hold
 * onto the order ids they've placed in localStorage and re-fetch them
 * by id on the home screen.
 */

const KEY_PREFIX = "qf:recent-orders:";
const MAX_KEEP = 12;

function key(tenantSlug: string) {
  return `${KEY_PREFIX}${tenantSlug}`;
}

export function recordRecentOrder(tenantSlug: string, orderId: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readRecentOrderIds(tenantSlug);
    const next = [orderId, ...existing.filter((id) => id !== orderId)].slice(0, MAX_KEEP);
    window.localStorage.setItem(key(tenantSlug), JSON.stringify(next));
  } catch {
    /* localStorage unavailable - silently drop */
  }
}

export function readRecentOrderIds(tenantSlug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(tenantSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function forgetRecentOrder(tenantSlug: string, orderId: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = readRecentOrderIds(tenantSlug).filter((id) => id !== orderId);
    window.localStorage.setItem(key(tenantSlug), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
