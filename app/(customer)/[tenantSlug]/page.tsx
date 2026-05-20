import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { CustomerHome } from "@/components/customer/screens/CustomerHome";
import { IcoArrowLeft } from "@/components/shared/Icons";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const session = await getSession();

  const [categories, popular, lastOrder] = await Promise.all([
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
    session?.type === "customer"
      ? prisma.order.findFirst({
          where: { tenantId: tenant.id, customerId: session.userId },
          orderBy: { createdAt: "desc" },
          include: {
            items: {
              orderBy: { totalPrice: "desc" },
              include: { menuItem: { select: { images: true } } },
            },
          },
        })
      : Promise.resolve(null),
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

  const lastOrderSerialized = lastOrder
    ? {
        id: lastOrder.id,
        number: lastOrder.number,
        total: lastOrder.total,
        status: lastOrder.status,
        createdAt: lastOrder.createdAt.toISOString(),
        itemCount: lastOrder.items.reduce((sum, it) => sum + it.quantity, 0),
        headlineItem: lastOrder.items[0]?.nameSnapshot ?? null,
        headlineImage: lastOrder.items[0]?.menuItem?.images?.[0] ?? null,
      }
    : null;

  return (
    <CustomerHome
      tenant={{
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        logoLetter: tenant.logoLetter,
        cuisineType: tenant.cuisineType,
        businessType: tenant.businessType,
        coverImage: tenant.coverImage,
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
      categories={categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }))}
      popular={popularSerialized}
      lastOrder={lastOrderSerialized}
    >
      <Link
        href={`/${tenant.slug}/menu`}
        className="text-xs text-(--qf-deep) underline pt-2 inline-flex items-center justify-center gap-1 w-full"
      >
        לתפריט המלא
        <IcoArrowLeft c="currentColor" s={12} />
      </Link>
    </CustomerHome>
  );
}
