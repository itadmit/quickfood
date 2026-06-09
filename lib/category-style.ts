/**
 * Shared registry for the Wolt-style category chips: a curated set of food/drink
 * icons (lucide) and a pastel color palette. Used by both the merchant editor
 * (pickers) and the customer storefront (chip rendering).
 *
 * Stored in DB as small string slugs (icon: "pizza", color: "tomato") so the
 * UI can evolve without DB migrations.
 */

import type { LucideIcon } from "lucide-react";
import {
  Pizza,
  Hamburger,
  Sandwich,
  Salad,
  Fish,
  Soup,
  Coffee,
  Croissant,
  IceCream,
  CookingPot,
  UtensilsCrossed,
  Beer,
  Wine,
  CupSoda,
  Cookie,
  Cake,
  Candy,
  Drumstick,
  ChefHat,
  Leaf,
  Flame,
  Percent,
  CircleDollarSign,
  Wheat,
} from "lucide-react";

// ─── Icons ──────────────────────────────────────────────────────

export type CategoryIconKey =
  | "pizza"
  | "burger"
  | "sandwich"
  | "salad"
  | "fish"
  | "soup"
  | "coffee"
  | "bakery"
  | "icecream"
  | "pot"
  | "utensils"
  | "beer"
  | "wine"
  | "soda"
  | "cookie"
  | "cake"
  | "candy"
  | "chicken"
  | "chef"
  | "leaf"
  | "flame"
  | "percent"
  | "money"
  | "wheat";

export const CATEGORY_ICONS: Record<CategoryIconKey, { Icon: LucideIcon; label: string }> = {
  pizza: { Icon: Pizza, label: "פיצה" },
  burger: { Icon: Hamburger, label: "המבורגר" },
  sandwich: { Icon: Sandwich, label: "כריך" },
  salad: { Icon: Salad, label: "סלט" },
  fish: { Icon: Fish, label: "דג" },
  soup: { Icon: Soup, label: "מרק" },
  coffee: { Icon: Coffee, label: "קפה" },
  bakery: { Icon: Croissant, label: "מאפים" },
  icecream: { Icon: IceCream, label: "גלידה" },
  pot: { Icon: CookingPot, label: "סיר" },
  utensils: { Icon: UtensilsCrossed, label: "מנות" },
  beer: { Icon: Beer, label: "בירה" },
  wine: { Icon: Wine, label: "יין" },
  soda: { Icon: CupSoda, label: "משקה" },
  cookie: { Icon: Cookie, label: "עוגייה" },
  cake: { Icon: Cake, label: "עוגה" },
  candy: { Icon: Candy, label: "ממתק" },
  chicken: { Icon: Drumstick, label: "עוף" },
  chef: { Icon: ChefHat, label: "שף" },
  leaf: { Icon: Leaf, label: "טבעוני" },
  flame: { Icon: Flame, label: "חריף" },
  percent: { Icon: Percent, label: "מבצע" },
  money: { Icon: CircleDollarSign, label: "כלכלי" },
  wheat: { Icon: Wheat, label: "דגנים" },
};

export const DEFAULT_ICON: CategoryIconKey = "utensils";

export function isCategoryIcon(key: string | null | undefined): key is CategoryIconKey {
  return !!key && key in CATEGORY_ICONS;
}

// ─── Colors ─────────────────────────────────────────────────────

export type CategoryColorKey =
  | "green"
  | "tomato"
  | "yolk"
  | "rose"
  | "blue"
  | "purple"
  | "orange"
  | "teal";

export interface CategoryColor {
  bg: string;
  fg: string;
  label: string;
}

export const CATEGORY_COLORS: Record<CategoryColorKey, CategoryColor> = {
  green:  { bg: "#daf0e2", fg: "#0e7a3c", label: "ירוק" },
  tomato: { bg: "#fde2d8", fg: "#c2421f", label: "אדום" },
  yolk:   { bg: "#fce9b6", fg: "#a37815", label: "צהוב" },
  rose:   { bg: "#fcdfe2", fg: "#a83b4a", label: "ורוד" },
  blue:   { bg: "#d4e6f7", fg: "#1d4d83", label: "כחול" },
  purple: { bg: "#e7daf3", fg: "#5a347a", label: "סגול" },
  orange: { bg: "#fadcc4", fg: "#a04b15", label: "כתום" },
  teal:   { bg: "#cfe8e6", fg: "#1d6864", label: "טורקיז" },
};

export const DEFAULT_COLOR: CategoryColorKey = "green";

export function isCategoryColor(key: string | null | undefined): key is CategoryColorKey {
  return !!key && key in CATEGORY_COLORS;
}

export const THEME_DEFAULT_CATEGORY_COLOR: Record<string, CategoryColorKey> = {
  fresh:     "green",
  basil:     "green",
  forest:    "teal",
  olive:     "green",
  tomato:    "tomato",
  charcoal:  "blue",
  cobalt:    "blue",
  sunflower: "yolk",
};

// ─── Resolver ───────────────────────────────────────────────────

export function resolveCategoryStyle(
  icon: string | null | undefined,
  color: string | null | undefined,
  themeDefaultColor?: CategoryColorKey,
) {
  const iconKey: CategoryIconKey = isCategoryIcon(icon) ? icon : DEFAULT_ICON;
  const fallback: CategoryColorKey = themeDefaultColor ?? DEFAULT_COLOR;
  const colorKey: CategoryColorKey = isCategoryColor(color) ? color : fallback;
  return {
    iconKey,
    colorKey,
    Icon: CATEGORY_ICONS[iconKey].Icon,
    bg: CATEGORY_COLORS[colorKey].bg,
    fg: CATEGORY_COLORS[colorKey].fg,
  };
}
