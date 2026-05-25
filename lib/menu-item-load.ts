import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";

export type MenuItemForCustomer = NonNullable<
  Awaited<ReturnType<typeof loadMenuItemForCustomer>>
>["item"];

export function loadMenuItemForCustomer(tenantSlug: string, itemId: string) {
  return unstable_cache(
    () => _fetch(tenantSlug, itemId),
    ["menu-item", tenantSlug, itemId],
    { tags: [`menu-item-${itemId}`], revalidate: false },
  )();
}

async function _fetch(tenantSlug: string, itemId: string) {
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return null;

  const row = await prisma.menuItem.findFirst({
    where: { id: itemId, tenantId: tenant.id, available: true },
    include: {
      sizes: { orderBy: { position: "asc" } },
      optionGroups: {
        orderBy: { position: "asc" },
        include: {
          options: { orderBy: { position: "asc" } },
          templateSet: { include: { options: { orderBy: { position: "asc" } } } },
        },
      },
    },
  });
  if (!row) return null;

  return {
    tenant: {
      slug: tenant.slug,
      businessType: tenant.businessType,
    },
    item: {
      id: row.id,
      name: row.name,
      description: row.description,
      basePrice: row.basePrice,
      artType: row.artType,
      images: row.images,
      tags: row.tags,
      sizes: row.sizes.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        priceDelta: s.priceDelta,
        isDefault: s.isDefault,
      })),
      optionGroups: row.optionGroups.map((g) => {
        const fromSet = g.templateSet;
        const opts = fromSet ? fromSet.options : g.options;
        return {
          id: g.id,
          name: fromSet?.name ?? g.name,
          type: fromSet?.type ?? g.type,
          required: fromSet?.required ?? g.required,
          minSelect: fromSet?.minSelect ?? g.minSelect,
          maxSelect: fromSet?.maxSelect ?? g.maxSelect,
          includedFree: fromSet?.includedFree ?? g.includedFree,
          helpText: fromSet?.helpText ?? g.helpText,
          options: opts
            .filter((o) => o.available)
            .map((o) => ({
              id: o.id,
              name: o.name,
              priceDelta: o.priceDelta,
              isDefault: o.isDefault,
              imageUrl: o.imageUrl,
            })),
        };
      }),
    },
  };
}
