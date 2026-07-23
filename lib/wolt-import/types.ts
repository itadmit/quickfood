// Subset of the Wolt /v4/venues/{id}/menu response we actually consume.
// The full response has 60+ fields; we lock down only what the importer
// touches so a future Wolt schema change can't silently break things.

export interface WoltCategory {
  id: string;
  name: string;
  description?: string;
  image?: string | null;
  parent_category_id?: string | null;
  slug?: string;
}

export interface WoltOptionGroupRefOnItem {
  id: string;
  name: string;
  parent?: string;
  free_selections?: number;
  minimum_total_selections?: number;
  maximum_total_selections?: number;
  maximum_single_selections?: number;
}

export interface WoltItem {
  id: string;
  name: string;
  description?: string;
  category: string; // category id
  enabled?: boolean;
  baseprice?: number; // agorot
  original_price?: number | null;
  image?: string | null;
  images?: string[];
  options?: WoltOptionGroupRefOnItem[];
  tags?: string[];
}

export interface WoltOptionValue {
  id: string;
  name: string;
  price: number; // agorot, delta on top of item baseprice
}

export interface WoltOptionGroup {
  id: string;
  name: string;
  type: "Multichoice" | "Singlechoice" | string;
  values: WoltOptionValue[];
}

export interface WoltMenu {
  id: string;
  name?: string;
  categories: WoltCategory[];
  items: WoltItem[];
  options: WoltOptionGroup[];
}

/**
 * One row from `opening_times_schedule[]` / `delivery_times_schedule[]`.
 * Wolt only publishes the *formatted* display string ("11:30–22:00" or
 * "סגורים כרגע") - there is no machine-readable time field in the
 * public payload, so the parser in hours.ts has to regex it.
 */
export interface WoltScheduleEntry {
  day: string;
  formatted_times: string;
}

/**
 * Subset of the venue payload we scrape from the Wolt restaurant HTML
 * page (the `"venue":{ ... }` blob inlined for SSR). All optional
 * because field availability depends on the merchant's Wolt setup -
 * e.g. `website` is null when no link is provided, `phone` can be
 * absent for some venues.
 */
export interface WoltVenue {
  id: string;
  slug?: string;
  name: string;
  description?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  post_code?: string | null;
  timezone?: string | null;
  image_url?: string | null;
  brand_logo_image_url?: string | null;
  opening_times_schedule?: WoltScheduleEntry[] | null;
  delivery_times_schedule?: WoltScheduleEntry[] | null;
  delivery_methods?: string[] | null;
  delivery_geo_range?: unknown;
  rating?: {
    rating?: number;
    score?: string;
    score_raw?: number;
    volume?: number;
  } | null;
}

export interface WoltVenueInfo {
  venueId: string;
  slug: string;
  name: string;
  venue: WoltVenue;
}

// Shape returned by the preview endpoint to the dashboard UI - small
// enough to ship over the wire without the full menu (which lives in
// WoltImport.rawMenu server-side).
export interface ImportPreview {
  importId: string;
  venueName: string;
  categoriesCount: number;
  itemsCount: number;
  optionsCount: number;
  imagesCount: number;
  sampleItems: Array<{ name: string; image: string | null; price: number }>;
  venueInfo: VenueInfoPreview;
}

/**
 * What the importer sees on Wolt vs. what the tenant currently has in
 * QF - drives the checkbox UI. Defaulting a checkbox to `on` makes
 * sense when QF is empty and Wolt has a value; merchants can flip them
 * off to keep their own data.
 */
export interface VenueInfoPreview {
  wolt: {
    name: string;
    about: string | null;
    address: string | null;
    phone: string | null;
    coverImageUrl: string | null;
    logoImageUrl: string | null;
    hours: Array<{ day: string; label: string; display: string; active: boolean }>;
    hasHours: boolean;
  };
  current: {
    name: string;
    about: string | null;
    address: string | null;
    phone: string | null;
    coverImage: string | null;
    logoUrl: string | null;
    hasHours: boolean;
  };
}

/** Per-field opt-in flags sent on commit; omitting = don't touch. */
export interface ApplyVenueInfo {
  name?: boolean;
  about?: boolean;
  address?: boolean;
  phone?: boolean;
  hours?: boolean;
  cover?: boolean;
  logo?: boolean;
}
