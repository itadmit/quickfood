import type { WoltMenu, WoltVenueInfo } from "./types";

// Browser-flavored UA. The legacy /v3/venues/slug endpoint requires a
// recent Wolt app version header and returns "update the app" otherwise;
// /v4/venues/{id}/menu is happy with a plain Chrome UA, which is what we
// use for both the HTML scrape (to discover venue_id) and the menu fetch.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const HTML_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
};

const API_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json",
  "Accept-Language": "he-IL,he;q=0.9",
};

export class WoltFetchError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "WoltFetchError";
  }
}

/**
 * Pull the slug from a Wolt venue URL. Tolerates trailing slashes,
 * query strings, and the optional language prefix (`/he/`, `/en/`...).
 *   wolt.com/he/isr/rishon-lezion-hashfela-area/restaurant/pizza-ninjagedera
 *   → "pizza-ninjagedera"
 */
export function extractSlug(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/wolt\.com$/i.test(u.hostname.replace(/^www\./, ""))) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "restaurant" || p === "venue");
    if (idx === -1 || idx === parts.length - 1) return null;
    return parts[idx + 1];
  } catch {
    return null;
  }
}

/**
 * Wolt no longer publishes a slug→venue_id JSON endpoint we can reach;
 * the legacy /v3/venues/slug returns 410 without a current app version.
 * The venue HTML page (which a regular browser loads anyway) embeds the
 * venue document inline as `"venue":{"id":"<24-hex>", ...}` — regex on
 * that is good enough and far less brittle than the JSON-LD blob.
 */
export async function resolveVenue(url: string): Promise<WoltVenueInfo> {
  const slug = extractSlug(url);
  if (!slug) {
    throw new WoltFetchError(
      "bad_url",
      "הקישור לא נראה כמו כתובת חנות וולט תקינה",
    );
  }
  const res = await fetch(url, { headers: HTML_HEADERS, redirect: "follow" });
  if (!res.ok) {
    throw new WoltFetchError(
      "venue_unreachable",
      `וולט החזירה ${res.status} עבור הכתובת הזו`,
    );
  }
  const html = await res.text();
  const m = html.match(/"venue":\{"id":"([a-f0-9]{20,32})"/);
  if (!m) {
    throw new WoltFetchError(
      "venue_not_found",
      "לא הצלחנו לזהות את החנות בדף שוולט החזירה — ייתכן שהיא סגורה זמנית",
    );
  }
  const venueId = m[1];
  const nameMatch = html.match(/"venue":\{[^}]*"name":"([^"]+)"/);
  return {
    venueId,
    name: nameMatch?.[1] ?? slug,
  };
}

/**
 * Fetch the full menu document. ~50–150KB JSON depending on catalog size.
 * Caller is responsible for stowing it in WoltImport.rawMenu so the
 * commit step doesn't have to re-hit Wolt (and so we have an audit
 * trail if mapping ever blows up).
 */
export async function fetchMenu(venueId: string): Promise<WoltMenu> {
  const res = await fetch(
    `https://restaurant-api.wolt.com/v4/venues/${venueId}/menu`,
    { headers: API_HEADERS },
  );
  if (!res.ok) {
    throw new WoltFetchError(
      "menu_unreachable",
      `וולט החזירה ${res.status} בעת שליפת התפריט`,
    );
  }
  const json = (await res.json()) as WoltMenu;
  if (!Array.isArray(json.categories) || !Array.isArray(json.items)) {
    throw new WoltFetchError("menu_malformed", "פורמט תפריט וולט לא מוכר");
  }
  return json;
}

/** Download an image from Wolt's CDN. Returns Uint8Array + mime sniff. */
export async function fetchImage(
  url: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const ct =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    return { bytes: buf, contentType: ct };
  } catch {
    return null;
  }
}
