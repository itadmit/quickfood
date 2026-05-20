import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";
import { CustomerHome } from "@/components/customer/screens/CustomerHome";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const [categories, popular] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { position: "asc" },
      take: 8,
    }),
    prisma.menuItem.findMany({
      where: { tenantId: tenant.id, available: true, tags: { has: "פופולרי" } },
      orderBy: { position: "asc" },
      take: 6,
    }),
  ]);

  const popularSerialized = popular.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    basePrice: p.basePrice,
    artType: p.artType,
    images: p.images,
  }));

  const branch = tenant.branches[0];

  return (
    <CustomerHome
      tenant={{
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        logoLetter: tenant.logoLetter,
        cuisineType: tenant.cuisineType,
        businessType: tenant.businessType,
      }}
      branch={
        branch
          ? {
              address: branch.address,
              status: branch.status,
              deliveryFee: branch.deliveryFee,
              minOrder: branch.minOrder,
            }
          : null
      }
      categories={categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon }))}
      popular={popularSerialized}
    >
      <Link
        href={`/${tenant.slug}/menu`}
        className="block text-center text-xs text-(--qf-deep) underline pb-24 pt-2"
      >
        לתפריט המלא ←
      </Link>
    </CustomerHome>
  );
}
