import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";

/**
 * Single source of truth for fetching a customer-facing menu item.
 * Used by:
 *   - The full page  app/(customer)/[tenantSlug]/menu/[itemId]/page.tsx
 *   - The modal slot app/(customer)/[tenantSlug]/@modal/(.)menu/[itemId]
 *
 * Returns `null` when the tenant or item is missing / unavailable so
 * each caller decides how to handle that (notFound() for the page,
 * close the modal for the slot).
 *
 * Shape mirrors the props ItemDetail expects so callers can pass the
 * result straight through.
 */
export type MenuItemForCustomer = NonNullable<
  Awaited<ReturnType<typeof loadMenuItemForCustomer>>
>["item"];

export async function loadMenuItemForCustomer(
  tenantSlug: string,
  itemId: string,
) {
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
        // When a group is templated (linked to a ModifierSet) the
        // set's options + metadata override the inline group fields.
        // This is the same mapping the previous page-only loader did.
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
