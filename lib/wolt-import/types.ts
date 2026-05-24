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

export interface WoltVenueInfo {
  venueId: string;
  name: string;
}

// Shape returned by the preview endpoint to the dashboard UI — small
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
}
