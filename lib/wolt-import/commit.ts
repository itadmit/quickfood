import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { uploadBytes } from "@/lib/storage/r2";
import { fetchImage } from "./fetch";
import { woltScheduleToHours } from "./hours";
import { WOLT_IMPORT_TERMS_VERSION } from "./terms";
import type {
  ApplyVenueInfo,
  WoltCategory,
  WoltItem,
  WoltMenu,
  WoltOptionGroup,
  WoltOptionGroupRefOnItem,
  WoltVenue,
} from "./types";

const SOURCE = "wolt";

type ImportError = { context: string; message: string };

export interface CommitOptions {
  applyVenueInfo?: ApplyVenueInfo;
  /** Merchant user id that triggered the commit (audit trail). */
  importedByUserId?: string;
}

/**
 * Run the commit half of a Wolt import. Reads WoltImport.rawMenu (stowed
 * by the preview step), upserts MenuCategory + ModifierSet + MenuItem
 * rows keyed by (tenantId, externalSource='wolt', externalId), then
 * streams image uploads to R2 in the background.
 *
 * Behavior worth knowing about:
 *   • Prices on Wolt are agorot (₪5 = 500). QuickFood stores integer
 *     shekels. We round to the nearest shekel.
 *   • Wolt sub-categories (parent_category_id != null) are flattened -
 *     the sub-category becomes a top-level QF category named
 *     "<parent> · <child>", since the QF MenuCategory model is flat.
 *   • Disabled items are still imported with available=false so the
 *     merchant sees the full catalog and can re-enable selectively.
 *   • Image fetch failures don't fail the import - they get logged into
 *     `errors[]` and the item is created without an image.
 */
export async function commitImport(
  importId: string,
  opts: CommitOptions = {},
): Promise<{
  categoriesImported: number;
  itemsImported: number;
  imagesUploaded: number;
  venueInfoApplied: string[];
  errors: ImportError[];
}> {
  const row = await prisma.woltImport.findUnique({ where: { id: importId } });
  if (!row) throw new Error("import_not_found");
  if (row.status === "committed") {
    return {
      categoriesImported: row.categoriesImported,
      itemsImported: row.itemsImported,
      imagesUploaded: row.imagesUploaded,
      venueInfoApplied: [],
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
  // Wolt stores min/max/required on the per-item ref, not on the group
  // itself. The runtime serializer reads catalog-set values first, so
  // we seed the set with the first item ref's config - on re-import we
  // leave it alone, preserving any catalog edits the merchant made.
  const firstRefByGroup = new Map<string, WoltOptionGroupRefOnItem>();
  for (const it of menu.items) {
    for (const ref of it.options ?? []) {
      const groupId = ref.parent ?? ref.id;
      if (!firstRefByGroup.has(groupId)) firstRefByGroup.set(groupId, ref);
    }
  }
  const setIdMap = new Map<string, string>(); // wolt option group id → QF set id

  for (const [idx, g] of menu.options.entries()) {
    try {
      const type = g.type === "Singlechoice" ? "single" : "multi";
      const ref = firstRefByGroup.get(g.id);
      const minSel = ref?.minimum_total_selections ?? 0;
      const maxSel = ref?.maximum_total_selections ?? 5;
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
          required: minSel > 0,
          minSelect: minSel,
          maxSelect: maxSel,
          includedFree: ref?.free_selections ?? 0,
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

      // Sync the options for this set - upsert in place by externalId so
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

      await prisma.itemOptionGroup.deleteMany({ where: { itemId: saved.id } });
      for (const [gidx, ref] of (it.options ?? []).entries()) {
        const topLevelId = ref.parent ?? ref.id;
        const templateSetId = setIdMap.get(topLevelId);
        if (!templateSetId) {
          errors.push({
            context: `item_option_group:${it.name}:${ref.name}`,
            message: `קבוצת תוספות "${ref.name}" לא נמצאה ברשימת ה-option groups של וולט (parent=${topLevelId})`,
          });
          continue;
        }
        await prisma.itemOptionGroup.create({
          data: {
            itemId: saved.id,
            name: ref.name,
            type: pickGroupType(menu.options, topLevelId),
            required: (ref.minimum_total_selections ?? 0) > 0,
            minSelect: ref.minimum_total_selections ?? 0,
            maxSelect: ref.maximum_total_selections ?? 1,
            includedFree: ref.free_selections ?? 0,
            position: gidx,
            templateSetId,
          },
        });
      }

      // Future-proof: Wolt's newer payloads sometimes ship `images[]`
      // with the legacy `image` field empty. Take whichever is set,
      // skip the item only if a usable image already lives on the
      // QF row (re-runs of commit don't re-download every image).
      const sourceImage = it.image || it.images?.[0] || null;
      if (sourceImage && !saved.imageUrl) {
        itemsToImage.push({ qfItemId: saved.id, sourceUrl: sourceImage });
      }
    } catch (err) {
      errors.push({
        context: `item:${it.name}`,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Mark the import committed BEFORE the image loop. A 100-image
  // catalog plus a slow Wolt CDN can push past Vercel's per-function
  // ceiling - if we leave the status flip for the end, a timeout
  // strands the row at "preview" forever (catch in the route handler
  // never fires when Vercel kills the function), even though the
  // categories/items/modifiers all landed. Merchants then can't see
  // their menu live and have no way to retry. Flip first; the image
  // loop is best-effort and resumable via the skip-if-already-set
  // gate above.
  await prisma.woltImport.update({
    where: { id: importId },
    data: {
      status: "committed",
      categoriesImported,
      itemsImported,
      imagesUploaded: 0,
      errors: errors.length > 0 ? (errors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      committedAt: new Date(),
      importedByUserId: opts.importedByUserId ?? null,
      termsVersion: WOLT_IMPORT_TERMS_VERSION,
    },
  });

  // ─── 4. Images (R2) ──────────────────────────────────────────────
  // Sequential-ish with a small parallelism cap so we don't OOM the
  // Vercel function on a 100-image catalog. Each failure stays in
  // errors[] but doesn't unwind anything. If the function times out
  // here, the merchant can re-trigger commit and only the unfinished
  // items get re-downloaded (skip-if-already-set above).
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
            data: { imageUrl: publicUrl, images: [publicUrl] },
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

  const venue = row.rawVenue as unknown as WoltVenue | null;
  const venueInfoApplied = venue
    ? await applyVenueInfo({
        tenantId,
        venue,
        flags: opts.applyVenueInfo ?? {},
        errors,
      })
    : [];

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

  return {
    categoriesImported,
    itemsImported,
    imagesUploaded,
    venueInfoApplied,
    errors,
  };
}

async function applyVenueInfo({
  tenantId,
  venue,
  flags,
  errors,
}: {
  tenantId: string;
  venue: WoltVenue;
  flags: ApplyVenueInfo;
  errors: ImportError[];
}): Promise<string[]> {
  const applied: string[] = [];
  const tenantUpdate: Prisma.TenantUpdateInput = {};

  if (flags.about && venue.description) {
    tenantUpdate.about = venue.description.trim();
    applied.push("about");
  }

  if (flags.cover && venue.image_url) {
    const url = await uploadVenueImage(tenantId, venue.image_url, "cover", errors);
    if (url) {
      tenantUpdate.coverImage = url;
      applied.push("cover");
    }
  }

  if (flags.logo && venue.brand_logo_image_url) {
    const url = await uploadVenueImage(tenantId, venue.brand_logo_image_url, "logo", errors);
    if (url) {
      tenantUpdate.logoUrl = url;
      applied.push("logo");
    }
  }

  if (Object.keys(tenantUpdate).length > 0) {
    await prisma.tenant.update({ where: { id: tenantId }, data: tenantUpdate });
  }

  const wantsBranchPatch =
    !!flags.address || !!flags.phone || !!flags.hours;
  if (wantsBranchPatch) {
    const branchUpdate: Prisma.BranchUpdateInput = {};
    if (flags.address) {
      const a = [venue.address, venue.city].filter(Boolean).join(", ").trim();
      if (a) {
        branchUpdate.address = a;
        applied.push("address");
      }
    }
    if (flags.phone && venue.phone) {
      branchUpdate.phone = venue.phone.replace(/[\s()-]/g, "").trim();
      applied.push("phone");
    }
    if (flags.hours) {
      const hours = woltScheduleToHours(
        venue.opening_times_schedule ?? venue.delivery_times_schedule,
      );
      branchUpdate.hours = hours as unknown as Prisma.InputJsonValue;
      applied.push("hours");
    }

    if (Object.keys(branchUpdate).length > 0) {
      const primary = await prisma.branch.findFirst({
        where: { tenantId, isPrimary: true },
        select: { id: true },
      });
      const targetId = primary?.id
        ?? (await prisma.branch.findFirst({
          where: { tenantId },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        }))?.id;

      if (targetId) {
        await prisma.branch.update({ where: { id: targetId }, data: branchUpdate });
      } else {
        try {
          await prisma.branch.create({
            data: {
              tenantId,
              name: venue.name,
              isPrimary: true,
              phone:
                (branchUpdate.phone as string | undefined)
                ?? venue.phone?.replace(/[\s()-]/g, "")
                ?? "",
              address:
                (branchUpdate.address as string | undefined)
                ?? [venue.address, venue.city].filter(Boolean).join(", ")
                ?? "",
              hours: branchUpdate.hours ?? (Prisma.JsonNull as unknown as Prisma.InputJsonValue),
            },
          });
        } catch (err) {
          errors.push({
            context: "branch:create",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  return applied;
}

async function uploadVenueImage(
  tenantId: string,
  sourceUrl: string,
  kind: "cover" | "logo",
  errors: ImportError[],
): Promise<string | null> {
  const img = await fetchImage(sourceUrl);
  if (!img) {
    errors.push({
      context: `venue_${kind}`,
      message: `הורדת תמונת ${kind === "cover" ? "כריכה" : "לוגו"} מוולט נכשלה`,
    });
    return null;
  }
  try {
    const ext = mimeExt(img.contentType);
    const key = `tenants/${tenantId}/wolt-import/venue-${kind}-${Date.now()}.${ext}`;
    return await uploadBytes({
      key,
      body: img.bytes,
      contentType: img.contentType,
    });
  } catch (err) {
    errors.push({
      context: `venue_${kind}`,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
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
