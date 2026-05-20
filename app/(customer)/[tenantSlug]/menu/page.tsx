import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";
import { CustomerMenu } from "@/components/customer/screens/CustomerMenu";

export const dynamic = "force-dynamic";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { position: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: tenant.id, available: true },
      orderBy: [{ categoryId: "asc" }, { position: "asc" }],
    }),
  ]);

  return (
    <CustomerMenu
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      items={items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        name: i.name,
        description: i.description,
        basePrice: i.basePrice,
        artType: i.artType,
        tags: i.tags,
      }))}
    />
  );
}
