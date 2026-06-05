const KEY_PREFIX = "qf:order-tokens:";
const MAX_KEEP = 50;

function key(tenantSlug: string) {
  return `${KEY_PREFIX}${tenantSlug}`;
}

type TokenMap = Record<string, string>;

function readMap(tenantSlug: string): TokenMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key(tenantSlug));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: TokenMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(tenantSlug: string, map: TokenMap): void {
  if (typeof window === "undefined") return;
  try {
    const entries = Object.entries(map).slice(-MAX_KEEP);
    window.localStorage.setItem(key(tenantSlug), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* localStorage unavailable - silently drop */
  }
}

export function recordOrderToken(tenantSlug: string, orderId: string, token: string): void {
  const map = readMap(tenantSlug);
  map[orderId] = token;
  writeMap(tenantSlug, map);
}

export function readOrderToken(tenantSlug: string, orderId: string): string | null {
  return readMap(tenantSlug)[orderId] ?? null;
}

export function forgetOrderToken(tenantSlug: string, orderId: string): void {
  const map = readMap(tenantSlug);
  if (!(orderId in map)) return;
  delete map[orderId];
  writeMap(tenantSlug, map);
}
