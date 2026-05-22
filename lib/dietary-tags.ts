/**
 * Canonical list of menu-item tags / dietary badges.
 *
 * Tags are stored as Hebrew strings on `MenuItem.tags` (string[]) — that's
 * the source of truth. This module just adds metadata on top so the
 * customer menu can show colored chips and offer a "filter by tag" row.
 *
 * To add a new tag:
 *   1. Append it to TAG_DEFS below.
 *   2. The merchant editor will pick it up automatically (it iterates this
 *      list); the customer filter will too.
 *   3. Existing items already storing the Hebrew label will start filtering
 *      correctly with no migration needed.
 */

export type TagTone = "green" | "yellow" | "tomato" | "ink" | "muted";

export interface DietaryTag {
  /** The exact string stored on MenuItem.tags. */
  label: string;
  /** Whether the customer menu's filter row offers this tag as a chip. */
  filterable: boolean;
  /** Visual tone for the badge on item cards. */
  tone: TagTone;
}

export const TAG_DEFS: DietaryTag[] = [
  // Promotion/discovery badges — shown on cards but not in the filter row,
  // since "show me popular items only" isn't a useful filter.
  { label: "פופולרי",   filterable: false, tone: "yellow"  },
  { label: "חדש",       filterable: false, tone: "ink"     },
  { label: "מבצע",      filterable: false, tone: "tomato"  },
  { label: "המלצת השף", filterable: false, tone: "yellow"  },

  // Dietary filters — these ARE useful as filters.
  { label: "צמחוני",      filterable: true, tone: "green"  },
  { label: "טבעוני",      filterable: true, tone: "green"  },
  { label: "ללא גלוטן",   filterable: true, tone: "ink"    },
  { label: "ללא לקטוז",   filterable: true, tone: "ink"    },
  { label: "כשר",         filterable: true, tone: "ink"    },
  { label: "חריף",        filterable: true, tone: "tomato" },
  { label: "ללא אגוזים",  filterable: true, tone: "ink"    },
  { label: "חלבי",        filterable: true, tone: "muted"  },
  { label: "בשרי",        filterable: true, tone: "muted"  },
  { label: "פרווה",       filterable: true, tone: "muted"  },
];

/** Lookup metadata for a stored tag string. Returns null for free-text tags
    that aren't in the canonical list (so the UI can decide what to do). */
export function findTag(label: string): DietaryTag | null {
  return TAG_DEFS.find((t) => t.label === label) ?? null;
}

/** All tag labels offered to the merchant in the editor. */
export const ALL_TAG_LABELS = TAG_DEFS.map((t) => t.label);

/** Tags that the customer menu shows in its filter row. */
export const FILTERABLE_TAG_LABELS = TAG_DEFS.filter((t) => t.filterable).map(
  (t) => t.label,
);

/** Tailwind class fragments for each tone — used by both the merchant
    editor (selected state) and the customer card badge. */
export const TONE_CLASSES: Record<
  TagTone,
  { bg: string; text: string; border: string }
> = {
  green:  { bg: "bg-qf-green-soft", text: "text-qf-green-deep", border: "border-qf-green-deep/20" },
  yellow: { bg: "bg-qf-yolk-soft",  text: "text-qf-ink",        border: "border-qf-yolk/40"      },
  tomato: { bg: "bg-qf-tomato-soft",text: "text-qf-tomato",     border: "border-qf-tomato/30"    },
  ink:    { bg: "bg-qf-ink/5",      text: "text-qf-ink",        border: "border-qf-line-dash"    },
  muted:  { bg: "bg-qf-line-soft",  text: "text-qf-ink2",       border: "border-qf-line"         },
};
