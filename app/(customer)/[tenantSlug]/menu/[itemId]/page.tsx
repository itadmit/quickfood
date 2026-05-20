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
        include: { options: { orderBy: { position: "asc" } } },
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
        optionGroups: item.optionGroups.map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type,
          required: g.required,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          options: g.options.map((o) => ({
            id: o.id,
            name: o.name,
            priceDelta: o.priceDelta,
            isDefault: o.isDefault,
          })),
        })),
      }}
    />
  );
}
