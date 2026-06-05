import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

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
      imageUrl: source.imageUrl,
      images: source.images,
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
          templateSetId: g.templateSetId,
          position: gi,
          options: {
            create: g.options.map((o, oi) => ({
              name: o.name,
              priceDelta: o.priceDelta,
              isDefault: o.isDefault,
              available: o.available,
              imageUrl: o.imageUrl,
              position: oi,
            })),
          },
        })),
      },
    },
  });

  return apiJson({ item: { id: created.id, name: created.name } }, 201);
});
