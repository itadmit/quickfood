import { z } from "zod";

/**
 * Normalized menu shape produced by the AI extractor and edited by the
 * merchant before commit. Prices are integer shekels (QuickFood's money
 * convention - see the money-units memory). Modifiers map straight onto
 * inline ItemOptionGroup + ItemOption rows; no Wolt-style reusable
 * ModifierSet catalog is involved (PDF menus rarely share groups across
 * items cleanly, and inline keeps the merchant's edits local).
 */
export interface ExtractedOption {
  name: string;
  priceDelta: number;
}

export interface ExtractedModifierGroup {
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: ExtractedOption[];
}

export interface ExtractedItem {
  name: string;
  description: string;
  price: number;
  categoryName: string;
  modifierGroups: ExtractedModifierGroup[];
}

export interface ExtractedMenu {
  categories: string[];
  items: ExtractedItem[];
}

// ─── Zod schema for the merchant-edited tree sent back at commit ──────
// Kept tolerant (clamps/defaults) so the client editing UI never blocks a
// commit on a stray value; the commit step coerces into the strict
// ItemOptionGroup constraints itself.

const OptionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  priceDelta: z.number().int().default(0),
});

const GroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(["single", "multi"]).default("single"),
  required: z.boolean().default(false),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
  options: z.array(OptionSchema).default([]),
});

const ItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(800).default(""),
  price: z.number().int().min(0).default(0),
  categoryName: z.string().trim().min(1).max(80),
  modifierGroups: z.array(GroupSchema).default([]),
});

export const ExtractedMenuSchema = z.object({
  categories: z.array(z.string().trim().min(1).max(80)).default([]),
  items: z.array(ItemSchema).default([]),
});

export type ExtractedMenuInput = z.infer<typeof ExtractedMenuSchema>;

export interface MenuImportError {
  context: string;
  message: string;
}
