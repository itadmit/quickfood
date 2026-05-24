import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { uploadBytes } from "@/lib/storage/r2";
import { fetchImage } from "./fetch";
import type {
  WoltMenu,
  WoltCategory,
  WoltItem,
  WoltOptionGroup,
} from "./types";

const SOURCE = "wolt";

type ImportError = { context: string; message: string };

/**
 * Run the commit half of a Wolt import. Reads WoltImport.rawMenu (stowed
 * by the preview step), upserts MenuCategory + ModifierSet + MenuItem
 * rows keyed by (tenantId, externalSource='wolt', externalId), then
 * streams image uploads to R2 in the background.
 *
 * Behavior worth knowing about:
 *   • Prices on Wolt are agorot (₪5 = 500). QuickFood stores integer
 *     shekels. We round to the nearest shekel.
 *   • Wolt sub-categories (parent_category_id != null) are flattened —
 *     the sub-category becomes a top-level QF category named
 *     "<parent> · <child>", since the QF MenuCategory model is flat.
 *   • Disabled items are still imported with available=false so the
 *     merchant sees the full catalog and can re-enable selectively.
 *   • Image fetch failures don't fail the import — they get logged into
 *     `errors[]` and the item is created without an image.
 */
export async function commitImport(importId: string): Promise<{
  categoriesImported: number;
  itemsImported: number;
  imagesUploaded: number;
  errors: ImportError[];
}> {
  const row = await prisma.woltImport.findUnique({ where: { id: importId } });
  if (!row) throw new Error("import_not_found");
  if (row.status === "committed") {
    return {
      categoriesImported: row.categoriesImported,
      itemsImported: row.itemsImported,
      imagesUploaded: row.imagesUploaded,
      errors: (row.errors as ImportError[] | null) ?? [],
    };
  }
  const menu = row.rawMenu as unknown as WoltMenu | null;
  if (!menu) throw new Error("raw_menu_missing");

  const errors: ImportError[] = [];
  const tenantId = row.tenantId;

  // ─── 1. Categories ────────────────────────────────────────────────
  // Flatten the parent→child hierarchy. Pre-build a name map first so
  // we can prepend the parent name to subcategories in a single pass.
  const catByWoltId = new Map<string, WoltCategory>();
  menu.categories.forEach((c) => catByWoltId.set(c.id, c));

  const categoriesIdMap = new Map<string, string>(); // wolt cat id → QF cat id
  let categoriesImported = 0;

  for (const [idx, c] of menu.categories.entries()) {
    const parent = c.parent_category_id ? catByWoltId.get(c.parent_category_id) : null;
    const displayName = parent ? `${parent.name} · ${c.name}` : c.name;
    try {
      const saved = await prisma.menuCategory.upsert({
        where: {
          tenantId_externalSource_externalId: {
            tenantId,
            externalSource: SOURCE,
            externalId: c.id,
          },
        },
        create: {
          tenantId,
          name: displayName,
          position: idx,
          externalSource: SOURCE,
          externalId: c.id,
        },
        update: {
          name: displayName,
          position: idx,
        },
      });
      categoriesIdMap.set(c.id, saved.id);
      categoriesImported += 1;
    } catch (err) {
      errors.push({
        context: `category:${c.name}`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── 2. Modifier sets (Wolt top-level options) ────────────────────
  // Each option group becomes a reusable ModifierSet. Items will attach
  // via ItemOptionGroup.templateSetId in step 3 and apply their own
  // per-item min/max/includedFree overrides at attach time.
  const setIdMap = new Map<string, string>(); // wolt option group id → QF set id

  for (const [idx, g] of menu.options.entries()) {
    try {
      const type = g.type === "Singlechoice" ? "single" : "multi";
      const saved = await prisma.modifierSet.upsert({
        where: {
          tenantId_externalSource_externalId: {
            tenantId,
            externalSource: SOURCE,
            externalId: g.id,
          },
        },
        create: {
          tenantId,
          name: g.name,
          type,
          position: idx,
          externalSource: SOURCE,
          externalId: g.id,
        },
        update: {
          name: g.name,
          type,
          position: idx,
        },
      });
      setIdMap.set(g.id, saved.id);

      // Sync the options for this set — upsert in place by externalId so
      // a re-import keeps the same QF option ids (and order numbers
      // referenced from cart history stay valid).
      for (const [vidx, v] of g.values.entries()) {
        await prisma.modifierSetOption.upsert({
          where: {
            setId_externalId: { setId: saved.id, externalId: v.id },
          },
          create: {
            setId: saved.id,
            name: v.name,
            priceDelta: agorotToShekel(v.price),
            position: vidx,
            externalId: v.id,
          },
          update: {
            name: v.name,
            priceDelta: agorotToShekel(v.price),
            position: vidx,
          },
        });
      }
    } catch (err) {
      errors.push({
        context: `option_group:${g.name}`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── 3. Items + per-item option group attachments ────────────────
  let itemsImported = 0;
  const itemsToImage: Array<{ qfItemId: string; sourceUrl: string }> = [];

  for (const [idx, it] of menu.items.entries()) {
    const qfCategoryId = categoriesIdMap.get(it.category);
    if (!qfCategoryId) {
      errors.push({
        context: `item:${it.name}`,
        message: "המוצר משויך לקטגוריה שלא יובאה",
      });
      continue;
    }
    try {
      const saved = await prisma.menuItem.upsert({
        where: {
          tenantId_externalSource_externalId: {
            tenantId,
            externalSource: SOURCE,
            externalId: it.id,
          },
        },
        create: {
          tenantId,
          categoryId: qfCategoryId,
          name: it.name,
          description: it.description ?? "",
          basePrice: agorotToShekel(it.baseprice ?? 0),
          available: it.enabled !== false,
          position: idx,
          externalSource: SOURCE,
          externalId: it.id,
        },
        update: {
          categoryId: qfCategoryId,
          name: it.name,
          description: it.description ?? "",
          basePrice: agorotToShekel(it.baseprice ?? 0),
          available: it.enabled !== false,
          position: idx,
        },
      });
      itemsImported += 1;

      // Re-attach option groups. Simpler to clear + recreate than to
      // diff — these rows are cheap and merchant edits on imported
      // items would be lost on the next re-import anyway (by design).
      await prisma.itemOptionGroup.deleteMany({ where: { itemId: saved.id } });
      for (const [gidx, ref] of (it.options ?? []).entries()) {
        const templateSetId = setIdMap.get(ref.id);
        if (!templateSetId) continue; // group was on an unknown set
        await prisma.itemOptionGroup.create({
          data: {
            itemId: saved.id,
            name: ref.name,
            type: pickGroupType(menu.options, ref.id),
            required: (ref.minimum_total_selections ?? 0) > 0,
            minSelect: ref.minimum_total_selections ?? 0,
            maxSelect: ref.maximum_total_selections ?? 1,
            includedFree: ref.free_selections ?? 0,
            position: gidx,
            templateSetId,
          },
        });
      }

      if (it.image) {
        itemsToImage.push({ qfItemId: saved.id, sourceUrl: it.image });
      }
    } catch (err) {
      errors.push({
        context: `item:${it.name}`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── 4. Images (R2) ──────────────────────────────────────────────
  // Sequential-ish with a small parallelism cap so we don't OOM the
  // Vercel function on a 100-image catalog. Each failure stays in
  // errors[] but doesn't unwind anything.
  const PARALLEL = 4;
  let imagesUploaded = 0;
  for (let i = 0; i < itemsToImage.length; i += PARALLEL) {
    const batch = itemsToImage.slice(i, i + PARALLEL);
    const results = await Promise.all(
      batch.map(async ({ qfItemId, sourceUrl }) => {
        const img = await fetchImage(sourceUrl);
        if (!img) {
          errors.push({
            context: `image:${qfItemId}`,
            message: `הורדת תמונה נכשלה (${sourceUrl})`,
          });
          return false;
        }
        try {
          const ext = mimeExt(img.contentType);
          const key = `tenants/${tenantId}/wolt-import/${qfItemId}.${ext}`;
          const publicUrl = await uploadBytes({
            key,
            body: img.bytes,
            contentType: img.contentType,
          });
          await prisma.menuItem.update({
            where: { id: qfItemId },
            data: { imageUrl: publicUrl },
          });
          return true;
        } catch (err) {
          errors.push({
            context: `image:${qfItemId}`,
            message: err instanceof Error ? err.message : String(err),
          });
          return false;
        }
      }),
    );
    imagesUploaded += results.filter(Boolean).length;
  }

  // ─── 5. Seal the import row ──────────────────────────────────────
  await prisma.woltImport.update({
    where: { id: importId },
    data: {
      status: "committed",
      categoriesImported,
      itemsImported,
      imagesUploaded,
      errors: errors.length > 0 ? (errors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      committedAt: new Date(),
    },
  });

  return { categoriesImported, itemsImported, imagesUploaded, errors };
}

/**
 * 500 (agorot) → 5 (shekels). QuickFood stores integer shekels; rounding
 * lops off the last 99 agorot at worst, which is the same compromise
 * the merchant would make manually when re-keying ₪14.90 into the
 * dashboard (which doesn't accept fractional shekels).
 */
function agorotToShekel(agorot: number): number {
  return Math.round(agorot / 100);
}

function pickGroupType(
  groups: WoltOptionGroup[],
  id: string,
): "single" | "multi" {
  const g = groups.find((x) => x.id === id);
  return g?.type === "Singlechoice" ? "single" : "multi";
}

function mimeExt(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}
