import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/slug";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { CustomerHome } from "@/components/customer/screens/CustomerHome";
import { IcoArrowLeft } from "@/components/shared/Icons";
import { fingerprintOrderItems } from "@/lib/order-reorder";

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

  // Pull a wider window so we can dedupe to 3 distinct baskets even when a
  // customer keeps ordering the same thing back-to-back. Guests skip the
  // query entirely and hydrate on the client from localStorage.
  const customerRecentOrdersPromise =
    session?.type === "customer"
      ? prisma.order.findMany({
          where: { tenantId: tenant.id, customerId: session.userId },
          orderBy: { createdAt: "desc" },
          take: 12,
          include: {
            items: {
              orderBy: { totalPrice: "desc" },
              include: { menuItem: { select: { images: true } } },
            },
          },
        })
      : null;

  // Surface a "rate your last order" banner when the logged-in customer has
  // a delivered order that hasn't been reviewed and the prompt wasn't
  // dismissed. Only when the tenant has reviews enabled.
  const pendingReviewPromise =
    session?.type === "customer" && tenant.reviewsEnabled
      ? prisma.order.findFirst({
          where: {
            tenantId: tenant.id,
            customerId: session.userId,
            status: "delivered",
            review: null,
            reviewPromptDismissedAt: null,
          },
          orderBy: { deliveredAt: "desc" },
          select: { id: true, number: true, deliveredAt: true },
        })
      : null;

  const [categories, popular, customerRecentOrders, bannerCampaign, pendingReview] = await Promise.all([
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
    customerRecentOrdersPromise,
    prisma.campaign.findFirst({
      where: { tenantId: tenant.id, kind: "banner", isActive: true },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        style: true,
        title: true,
        subtitle: true,
        icon: true,
        color: true,
        imageUrl: true,
        linkUrl: true,
      },
    }),
    pendingReviewPromise,
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

  // Dedupe by content fingerprint so the rail never shows the same basket
  // twice; keep up to 3 distinct ones.
  const seenSig = new Set<string>();
  const distinctOrders: NonNullable<typeof customerRecentOrders> = [];
  for (const o of customerRecentOrders ?? []) {
    const sig = fingerprintOrderItems(o.items);
    if (seenSig.has(sig)) continue;
    seenSig.add(sig);
    distinctOrders.push(o);
    if (distinctOrders.length >= 3) break;
  }
  const recentOrdersSerialized = distinctOrders.map((o) => ({
    id: o.id,
    number: o.number,
    total: o.total,
    status: o.status,
    created_at: o.createdAt.toISOString(),
    item_count: o.items.reduce((sum, it) => sum + it.quantity, 0),
    headline_item: o.items[0]?.nameSnapshot ?? null,
    headline_image: o.items[0]?.menuItem?.images?.[0] ?? null,
  }));

  return (
    <CustomerHome
      tenant={{
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        logoLetter: tenant.logoLetter,
        logoUrl: tenant.logoUrl,
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
      recentOrders={recentOrdersSerialized}
      bannerCampaign={bannerCampaign}
      hasCustomerSession={session?.type === "customer"}
      pendingReviewOrderId={pendingReview?.id ?? null}
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
