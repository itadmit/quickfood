import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; itemId: string }>;
}) {
  const { tenantSlug, itemId } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const item = await prisma.menuItem.findFirst({
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
  if (!item) notFound();

  return (
    <ItemDetail
      tenantSlug={tenant.slug}
      businessType={tenant.businessType}
      item={{
        id: item.id,
        name: item.name,
        description: item.description,
        basePrice: item.basePrice,
        artType: item.artType,
        images: item.images,
        tags: item.tags,
        sizes: item.sizes.map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          priceDelta: s.priceDelta,
          isDefault: s.isDefault,
        })),
        optionGroups: item.optionGroups.map((g) => {
          // When the group is templated (linked to a ModifierSet) we render
          // the set's options, not the inline ItemOption rows. The set is
          // also allowed to override the group's name/help/limits, so that
          // editing the set propagates.
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
      }}
    />
  );
}
