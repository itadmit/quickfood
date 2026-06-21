import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import type { ExtractedMenuInput, MenuImportError } from "./types";

export interface CommitMenuFileOptions {
  importedByUserId?: string;
}

/**
 * Persist a merchant-confirmed PDF/image menu extraction into the tenant's
 * live menu. Categories are matched to existing ones by name (case-
 * insensitive) and created when missing; items are created with inline
 * option groups + options (no reusable ModifierSet catalog). Everything is
 * best-effort per item - a single bad row lands in `errors[]` and the rest
 * still import. The MenuFileImport row is flipped to committed at the end.
 */
export async function commitMenuFileImport(
  importId: string,
  menu: ExtractedMenuInput,
  opts: CommitMenuFileOptions = {},
): Promise<{
  categoriesImported: number;
  itemsImported: number;
  errors: MenuImportError[];
}> {
  const row = await prisma.menuFileImport.findUnique({ where: { id: importId } });
  if (!row) throw new Error("import_not_found");
  if (row.status === "committed") {
    return {
      categoriesImported: row.categoriesImported,
      itemsImported: row.itemsImported,
      errors: (row.errors as MenuImportError[] | null) ?? [],
    };
  }

  const tenantId = row.tenantId;
  const errors: MenuImportError[] = [];

  // ─── 1. Categories: find-or-create by name ───────────────────────
  const existing = await prisma.menuCategory.findMany({
    where: { tenantId },
    select: { id: true, name: true, position: true },
  });
  const byName = new Map<string, string>(); // lowercased name → id
  let maxPosition = -1;
  for (const c of existing) {
    byName.set(c.name.trim().toLowerCase(), c.id);
    if (c.position > maxPosition) maxPosition = c.position;
  }

  const wantedCategories = new Set<string>();
  for (const c of menu.categories) wantedCategories.add(c.trim());
  for (const it of menu.items) wantedCategories.add(it.categoryName.trim());

  let categoriesImported = 0;
  for (const name of wantedCategories) {
    if (!name) continue;
    const key = name.toLowerCase();
    if (byName.has(key)) continue;
    try {
      maxPosition += 1;
      const created = await prisma.menuCategory.create({
        data: { tenantId, name, position: maxPosition },
        select: { id: true },
      });
      byName.set(key, created.id);
      categoriesImported += 1;
    } catch (err) {
      errors.push({
        context: `category:${name}`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── 2. Items + inline option groups ─────────────────────────────
  let itemsImported = 0;
  for (const [idx, it] of menu.items.entries()) {
    const categoryId = byName.get(it.categoryName.trim().toLowerCase());
    if (!categoryId) {
      errors.push({
        context: `item:${it.name}`,
        message: `הקטגוריה "${it.categoryName}" לא נוצרה`,
      });
      continue;
    }
    try {
      await prisma.menuItem.create({
        data: {
          tenantId,
          categoryId,
          name: it.name,
          description: it.description ?? "",
          basePrice: it.price,
          available: true,
          position: idx,
          imageUrl: it.imageUrl || null,
          images: it.imageUrl ? [it.imageUrl] : [],
          optionGroups: {
            // Drop groups with no options - a "choose one" group with nothing
            // to choose is a dead end on the storefront (and a required one
            // would hard-block checkout).
            create: it.modifierGroups
              .filter((g) => g.options.length > 0)
              .map((g, gi) => {
                const single = g.type === "single";
                const maxSelect = single ? 1 : Math.max(1, g.maxSelect);
                const minSelect = g.required ? Math.max(1, g.minSelect) : 0;
                return {
                  name: g.name,
                  type: g.type,
                  required: g.required,
                  minSelect: Math.min(minSelect, maxSelect),
                  maxSelect,
                  includedFree: 0,
                  position: gi,
                  options: {
                    create: g.options.map((o, oi) => ({
                      name: o.name,
                      priceDelta: o.priceDelta,
                      position: oi,
                    })),
                  },
                };
              }),
          },
        },
      });
      itemsImported += 1;
    } catch (err) {
      errors.push({
        context: `item:${it.name}`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await prisma.menuFileImport.update({
    where: { id: importId },
    data: {
      status: "committed",
      categoriesImported,
      itemsImported,
      errors: errors.length > 0 ? (errors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      committedAt: new Date(),
      importedByUserId: opts.importedByUserId ?? null,
    },
  });

  return { categoriesImported, itemsImported, errors };
}
