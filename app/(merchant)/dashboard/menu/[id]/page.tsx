import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ItemEditor } from "../ItemEditor";

export const dynamic = "force-dynamic";

export default async function ItemEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const { id } = await params;
  const isNew = id === "new";

  const [categories, tenant, modifierSets] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: session.tenantId, active: true },
      orderBy: { position: "asc" },
    }),
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { businessType: true },
    }),
    prisma.modifierSet.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { position: "asc" },
      include: { options: { select: { id: true } } },
    }),
  ]);

  const modifierSetsForEditor = modifierSets.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type as "single" | "multi",
    optionsCount: s.options.length,
  }));

  if (isNew) {
    return (
      <ItemEditor
        mode="new"
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        businessType={tenant?.businessType ?? "general"}
        modifierSets={modifierSetsForEditor}
      />
    );
  }

  const item = await prisma.menuItem.findFirst({
    where: { id, tenantId: session.tenantId },
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
    <ItemEditor
      mode="edit"
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      businessType={tenant?.businessType ?? "general"}
      modifierSets={modifierSetsForEditor}
      item={{
        id: item.id,
        name: item.name,
        description: item.description,
        categoryId: item.categoryId,
        basePrice: item.basePrice,
        prepMinutes: item.prepMinutes,
        artType: item.artType,
        imageUrl: item.imageUrl,
        images: item.images,
        available: item.available,
        tags: item.tags,
        sku: item.sku,
        availableFrom: item.availableFrom,
        availableTo: item.availableTo,
        availableDays: item.availableDays,
        stockRemaining: item.stockRemaining,
        sizes: item.sizes.map((s) => ({
          code: s.code,
          name: s.name,
          priceDelta: s.priceDelta,
          isDefault: s.isDefault,
        })),
        optionGroups: item.optionGroups.map((g) => ({
          name: g.name,
          type: g.type as "single" | "multi",
          required: g.required,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect,
          includedFree: g.includedFree,
          helpText: g.helpText,
          templateSetId: g.templateSetId,
          options: g.options.map((o) => ({
            name: o.name,
            priceDelta: o.priceDelta,
            isDefault: o.isDefault,
            available: o.available,
            imageUrl: o.imageUrl,
          })),
        })),
      }}
    />
  );
}
