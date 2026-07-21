import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { copyImageUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;

  const source = await prisma.menuItem.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      sizes: { orderBy: { position: "asc" } },
      optionGroups: {
        orderBy: { position: "asc" },
        include: { options: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!source) return apiError("not_found", "פריט לא נמצא", 404);

  // The duplicate must own its images: both items pointing at the same R2
  // object means deleting the image from one silently breaks the other.
  // Same URL referenced twice (imageUrl + images[0]) copies once.
  const copyScope = `${session.tenantId}/menu_item_image`;
  const copied = new Map<string, string | null>();
  async function copyOnce(url: string | null | undefined): Promise<string | null> {
    if (!url) return null;
    if (!copied.has(url)) copied.set(url, await copyImageUrl(url, copyScope));
    return copied.get(url)!;
  }
  const sourceImages = Array.isArray(source.images) ? (source.images as string[]) : [];
  const newImageUrl = await copyOnce(source.imageUrl);
  const newImages: string[] = [];
  for (const u of sourceImages) {
    const dup = await copyOnce(u);
    if (dup) newImages.push(dup);
  }
  const newOptionImages = new Map<string, string | null>();
  for (const g of source.optionGroups) {
    for (const o of g.options) {
      newOptionImages.set(o.id, await copyOnce(o.imageUrl));
    }
  }

  // Append "(עותק)" to the name. Cap at the schema limit so we don't blow
  // the 120-char column on serial duplicates.
  const baseName = source.name.endsWith("(עותק)")
    ? source.name
    : `${source.name} (עותק)`;
  const newName = baseName.slice(0, 120);

  // Place the duplicate just after the source by giving it source.position + 1
  // and bumping everything below. Cheap on small menus; if we ever scale to
  // 1000+ items per tenant, switch to a sparse position scheme.
  await prisma.menuItem.updateMany({
    where: {
      tenantId: session.tenantId,
      categoryId: source.categoryId,
      position: { gt: source.position },
    },
    data: { position: { increment: 1 } },
  });

  const created = await prisma.menuItem.create({
    data: {
      tenantId: session.tenantId,
      categoryId: source.categoryId,
      name: newName,
      description: source.description,
      basePrice: source.basePrice,
      prepMinutes: source.prepMinutes,
      artType: source.artType,
      imageUrl: newImageUrl,
      images: newImages,
      // New duplicate stays HIDDEN by default - merchant must review before
      // it goes live so they don't accidentally double-list an item.
      available: false,
      featured: false,
      position: source.position + 1,
      tags: source.tags,
      sku: null, // SKU is unique by convention; force the merchant to set a fresh one
      sizes: {
        create: source.sizes.map((s, i) => ({
          code: s.code,
          name: s.name,
          priceDelta: s.priceDelta,
          isDefault: s.isDefault,
          position: i,
        })),
      },
      optionGroups: {
        create: source.optionGroups.map((g, gi) => ({
          name: g.name,
          type: g.type,
          required: g.required,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          includedFree: g.includedFree,
          helpText: g.helpText,
          allowHalf: g.allowHalf,
          allowQty: g.allowQty,
          splitPrice: g.splitPrice,
          customHalfPrice: g.customHalfPrice,
          bundleCount: g.bundleCount,
          bundlePrice: g.bundlePrice,
          maxPerSide: g.maxPerSide,
          templateSetId: g.templateSetId,
          position: gi,
          options: {
            create: g.options.map((o, oi) => ({
              name: o.name,
              priceDelta: o.priceDelta,
              halfPriceDelta: o.halfPriceDelta,
              isDefault: o.isDefault,
              available: o.available,
              imageUrl: newOptionImages.get(o.id) ?? null,
              maxQuantity: o.maxQuantity,
              position: oi,
            })),
          },
        })),
      },
    },
  });

  return apiJson({ item: { id: created.id, name: created.name } }, 201);
});
