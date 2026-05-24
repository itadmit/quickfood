import type { WoltMenu, WoltVenue, WoltVenueInfo } from "./types";

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

function extractVenueBlob(html: string): WoltVenue | null {
  const i = html.indexOf('"venue":{');
  if (i < 0) return null;
  let depth = 0;
  const start = i + '"venue":'.length;
  let j = start;
  for (; j < html.length; j++) {
    const c = html[j];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
  }
  try {
    return JSON.parse(html.slice(start, j)) as WoltVenue;
  } catch {
    return null;
  }
}

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
  const venue = extractVenueBlob(html);
  if (!venue?.id) {
    throw new WoltFetchError(
      "venue_not_found",
      "לא הצלחנו לזהות את החנות בדף שוולט החזירה — ייתכן שהיא סגורה זמנית",
    );
  }
  return { venueId: venue.id, name: venue.name || slug, venue };
}

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
