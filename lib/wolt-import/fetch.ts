import type {
  WoltCategory,
  WoltItem,
  WoltMenu,
  WoltOptionGroup,
  WoltOptionGroupRefOnItem,
  WoltVenue,
  WoltVenueInfo,
} from "./types";

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
      "לא הצלחנו לזהות את החנות בדף שוולט החזירה - ייתכן שהיא סגורה זמנית",
    );
  }
  return { venueId: venue.id, slug, name: venue.name || slug, venue };
}

// ─── New Wolt consumer-assortment API ─────────────────────────────
// Wolt retired the old `restaurant-api.wolt.com/v4/venues/{id}/menu`
// endpoint (it now returns 410 Gone). The current public API is the
// consumer-assortment service: a base call lists categories (each with
// its own image + slug), and items are fetched per-category by slug.
// We adapt that shape back into the internal WoltMenu the importer
// already knows, so commit.ts stays unchanged.
const ASSORT_API =
  "https://consumer-api.wolt.com/consumer-api/consumer-assortment/v1";

interface AssortImage {
  url: string;
  blurhash?: string | null;
}
interface AssortCategory {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  images?: AssortImage[] | null;
  item_ids?: string[];
  subcategories?: AssortCategory[] | null;
}
// Per-item reference to a shared option group, carrying this item's own
// selection limits (min/max/free) - the group definition lives in the
// response's `options[]`.
interface AssortItemOptionRef {
  id: string;
  option_id: string;
  name: string;
  multi_choice_config?: {
    total_range?: { min?: number; max?: number } | null;
    max_single_selections?: number | null;
    free_selections?: number | null;
  } | null;
}
interface AssortItem {
  id: string;
  name: string;
  description?: string;
  price?: number; // agorot
  images?: AssortImage[] | null;
  disabled_info?: unknown;
  options?: AssortItemOptionRef[] | null;
}
// A shared modifier group definition. `type` is "choice" (single) or
// "multi_choice"; `values[]` are the selectable options (price in agorot).
interface AssortOptionValue {
  id: string;
  name: string;
  price?: number;
}
interface AssortOptionGroup {
  id: string;
  name: string;
  type: string;
  values?: AssortOptionValue[] | null;
}
interface AssortResponse {
  categories?: AssortCategory[];
  items?: AssortItem[];
  options?: AssortOptionGroup[];
  variant_groups?: unknown[];
}

function mapOptionGroup(g: AssortOptionGroup): WoltOptionGroup {
  return {
    id: g.id,
    name: g.name,
    // Wolt "choice" = pick one; "multi_choice" = pick many. The internal
    // model + commit.ts key off "Singlechoice" / "Multichoice".
    type: g.type === "choice" ? "Singlechoice" : "Multichoice",
    values: (g.values ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price ?? 0,
    })),
  };
}

function mapItemOptionRef(r: AssortItemOptionRef): WoltOptionGroupRefOnItem {
  const range = r.multi_choice_config?.total_range;
  // `id` must be the shared group id so commit.ts's `parent ?? id` lookup
  // resolves against the mapped option groups.
  return {
    id: r.option_id,
    name: r.name,
    minimum_total_selections: range?.min ?? 0,
    maximum_total_selections: range?.max ?? 1,
    maximum_single_selections:
      r.multi_choice_config?.max_single_selections ?? undefined,
    free_selections: r.multi_choice_config?.free_selections ?? 0,
  };
}

async function getAssort(path: string): Promise<AssortResponse> {
  const res = await fetch(`${ASSORT_API}${path}`, { headers: API_HEADERS });
  if (!res.ok) {
    throw new WoltFetchError(
      "menu_unreachable",
      `וולט החזירה ${res.status} בעת שליפת התפריט`,
    );
  }
  return (await res.json()) as AssortResponse;
}

// Depth-first flatten so nested subcategories are imported too.
function flattenCategories(cats: AssortCategory[]): AssortCategory[] {
  const out: AssortCategory[] = [];
  const walk = (list: AssortCategory[]) => {
    for (const c of list) {
      out.push(c);
      if (c.subcategories?.length) walk(c.subcategories);
    }
  };
  walk(cats);
  return out;
}

// Bounded-concurrency map so a large catalog (dozens of categories)
// doesn't fire hundreds of parallel requests at Wolt.
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return out;
}

export async function fetchMenu(slug: string): Promise<WoltMenu> {
  const base = await getAssort(`/venues/slug/${slug}/assortment`);
  const baseCats = base.categories ?? [];
  if (baseCats.length === 0) {
    throw new WoltFetchError("menu_malformed", "פורמט תפריט וולט לא מוכר");
  }

  const flat = flattenCategories(baseCats);
  const categories: WoltCategory[] = flat.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    image: c.images?.[0]?.url ?? null,
    slug: c.slug,
  }));

  // Items live behind a per-category call keyed by category slug. Each
  // response also carries the shared option-group definitions its items
  // reference, so we harvest those here too.
  const perCat = await mapLimit(flat, 5, async (c) => {
    if (!c.slug) {
      return { catId: c.id, items: [] as AssortItem[], options: [] as AssortOptionGroup[] };
    }
    const resp = await getAssort(
      `/venues/slug/${slug}/assortment/categories/slug/${encodeURIComponent(c.slug)}`,
    );
    return { catId: c.id, items: resp.items ?? [], options: resp.options ?? [] };
  });

  // Dedupe option groups by id across all category responses - the same
  // group (eg "doneness") is repeated in every category whose items use it.
  const groupMap = new Map<string, WoltOptionGroup>();
  for (const { options } of perCat) {
    for (const g of options) {
      if (!groupMap.has(g.id)) groupMap.set(g.id, mapOptionGroup(g));
    }
  }

  const items: WoltItem[] = [];
  const seen = new Set<string>();
  for (const { catId, items: catItems } of perCat) {
    for (const it of catItems) {
      if (seen.has(it.id)) continue; // an item can surface under >1 category
      seen.add(it.id);
      items.push({
        id: it.id,
        name: it.name,
        description: it.description,
        category: catId,
        enabled: it.disabled_info == null,
        baseprice: it.price ?? 0,
        image: it.images?.[0]?.url ?? null,
        images: (it.images ?? []).map((im) => im.url).filter(Boolean),
        options: (it.options ?? []).map(mapItemOptionRef),
        tags: [],
      });
    }
  }

  return {
    id: slug,
    name: slug,
    categories,
    items,
    options: [...groupMap.values()],
  };
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
