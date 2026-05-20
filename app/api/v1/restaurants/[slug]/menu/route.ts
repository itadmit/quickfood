import { handler, apiJson, apiError } from "@/lib/api-response";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type ItemWithExtras = Prisma.MenuItemGetPayload<{
  include: {
    sizes: true;
    optionGroups: { include: { options: true } };
  };
}>;

export const GET = handler(async (_req, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { position: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: tenant.id, available: true },
      orderBy: { position: "asc" },
      include: {
        sizes: { orderBy: { position: "asc" } },
        optionGroups: {
          orderBy: { position: "asc" },
          include: { options: { orderBy: { position: "asc" } } },
        },
      },
    }),
  ]);

  return apiJson({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      position: c.position,
    })),
    items: items.map(serializeItem),
  });
});

function serializeItem(i: ItemWithExtras) {
  return {
    id: i.id,
    category_id: i.categoryId,
    name: i.name,
    description: i.description,
    image_url: i.imageUrl,
    art_type: i.artType,
    base_price: i.basePrice,
    prep_minutes: i.prepMinutes,
    tags: i.tags,
    available: i.available,
    sku: i.sku,
    sizes: i.sizes.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      price_delta: s.priceDelta,
      is_default: s.isDefault,
    })),
    option_groups: i.optionGroups.map((g) => ({
      id: g.id,
      name: g.name,
      type: g.type,
      required: g.required,
      min_select: g.minSelect,
      max_select: g.maxSelect,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        price_delta: o.priceDelta,
        is_default: o.isDefault,
      })),
    })),
  };
}
