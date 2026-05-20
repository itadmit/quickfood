import { prisma } from "@/lib/db/client";
import { TenantsList } from "./TenantsList";

export const dynamic = "force-dynamic";

export default async function TenantsListPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plan: { select: { name: true } },
      _count: { select: { orders: true, branches: true } },
    },
  });

  return (
    <TenantsList
      tenants={tenants.map((t) => ({
        id: t.id,
        slug: t.slug,
        name: t.name,
        status: t.status,
        themeId: t.themeId,
        cuisineType: t.cuisineType,
        plan: t.plan?.name ?? null,
        ordersCount: t._count.orders,
        branchesCount: t._count.branches,
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  );
}
