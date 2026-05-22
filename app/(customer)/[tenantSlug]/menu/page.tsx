import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";
import { CustomerMenu } from "@/components/customer/screens/CustomerMenu";
import { isItemVisibleNow } from "@/lib/menu-availability";

export const dynamic = "force-dynamic";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const [categories, allItems] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { position: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: tenant.id, available: true },
      orderBy: [{ categoryId: "asc" }, { position: "asc" }],
    }),
  ]);

  // Apply server-side time/day/stock filtering — items that have a
  // breakfast window of 7-11 don't show up at 14:00, items with weekday-
  // only restriction don't show on Saturday, items with 0 stock left
  // disappear. The merchant's boolean "available" toggle is still
  // honored by the DB query above.
  const items = allItems.filter((i) => isItemVisibleNow(i));

  return (
    <CustomerMenu
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      businessType={tenant.businessType}
      coverImage={tenant.coverImage}
      categories={categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }))}
      items={items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        name: i.name,
        description: i.description,
        basePrice: i.basePrice,
        artType: i.artType,
        images: i.images,
        tags: i.tags,
      }))}
    />
  );
}
