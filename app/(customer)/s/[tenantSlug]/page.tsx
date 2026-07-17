import { notFound } from "next/navigation";
import { resolveTenantBySlug } from "@/lib/slug";
import { storefrontCanonical } from "@/lib/storefront-url";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { CustomerHome } from "@/components/customer/screens/CustomerHome";
import { isItemVisibleNow } from "@/lib/menu-availability";
import { fingerprintOrderItems } from "@/lib/order-reorder";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ item?: string }>;
}) {
  const { item: itemId } = await searchParams;
  if (!itemId || !UUID_RE.test(itemId)) return {};

  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) return {};

  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, tenantId: tenant.id },
    select: { name: true, description: true, images: true, imageUrl: true },
  });
  if (!item) return {};

  const previewImage =
    item.images[0] ||
    item.imageUrl ||
    tenant.logoUrl ||
    tenant.coverImage ||
    null;
  const title = `${item.name} · ${tenant.name}`;
  const description =
    item.description?.trim() || `הזמינו ${item.name} מ${tenant.name}`;
  const url = storefrontCanonical(tenant, `?item=${itemId}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "he_IL",
      url,
      siteName: tenant.name,
      title,
      description,
      images: previewImage ? [{ url: previewImage, alt: item.name }] : [],
    },
    twitter: {
      card: previewImage ? "summary_large_image" : "summary",
      title,
      description,
      images: previewImage ? [previewImage] : [],
    },
  };
}

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

  // Cities the merchant covers (union of active zones on the primary
  // branch). Drives the Wolt-style "select your city" modal.
  const primaryBranchId = tenant.branches[0]?.id;
  const zonesPromise = primaryBranchId
    ? prisma.deliveryZone.findMany({
        where: { branchId: primaryBranchId, active: true },
        select: { name: true, cities: true },
      })
    : Promise.resolve([] as { name: string; cities: string[] }[]);

  const reviewsForSummaryPromise =
    tenant.reviewsEnabled && tenant.reviewsPublic
      ? prisma.review.findMany({
          where: { tenantId: tenant.id, status: "visible" },
          select: { rating: true },
        })
      : Promise.resolve([] as { rating: number }[]);

  const etaZonesPromise = primaryBranchId
    ? prisma.deliveryZone.findMany({
        where: { branchId: primaryBranchId, active: true },
        select: { minEta: true, maxEta: true },
      })
    : Promise.resolve([] as { minEta: number; maxEta: number }[]);

  const [
    allCategories,
    popular,
    allMenuItems,
    notices,
    activeDeals,
    customerRecentOrders,
    bannerCampaign,
    pendingReview,
    zones,
    reviewsForSummary,
    etaZones,
  ] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { position: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: tenant.id, available: true, tags: { has: "פופולרי" } },
      orderBy: { position: "asc" },
      take: 6,
    }),
    prisma.menuItem.findMany({
      where: { tenantId: tenant.id, available: true },
      // Featured items bubble within their category so the merchandising
      // signal shows up where the eye lands first.
      orderBy: [{ categoryId: "asc" }, { featured: "desc" }, { position: "asc" }],
    }),
    prisma.notice.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ position: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.deal.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: {
        slots: {
          orderBy: { position: "asc" },
          include: {
            choices: {
              orderBy: { position: "asc" },
              include: { item: { select: { images: true, available: true } } },
            },
          },
        },
      },
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
    zonesPromise,
    reviewsForSummaryPromise,
    etaZonesPromise,
  ]);

  const ratingAvg =
    reviewsForSummary.length > 0
      ? Math.round(
          (reviewsForSummary.reduce((a, r) => a + r.rating, 0) /
            reviewsForSummary.length) *
            10,
        ) / 10
      : 0;
  const ratingSummary =
    reviewsForSummary.length > 0
      ? { average: ratingAvg, count: reviewsForSummary.length }
      : null;

  const deliveryEta = etaZones.length > 0
    ? {
        min: Math.min(...etaZones.map((z) => z.minEta)),
        max: Math.max(...etaZones.map((z) => z.maxEta)),
      }
    : tenant.branches[0]
      ? {
          min: tenant.branches[0].defaultEtaMin,
          max: tenant.branches[0].defaultEtaMax,
        }
      : null;

  const menuItems = allMenuItems.filter((i) => isItemVisibleNow(i));
  const categories = allCategories.slice(0, 8);

  const seenCity = new Set<string>();
  const deliveryCities: string[] = [];
  for (const z of zones) {
    const list = z.cities.length > 0 ? z.cities : [z.name];
    for (const c of list) {
      const trimmed = c.trim();
      if (!trimmed) continue;
      const key = trimmed.toLocaleLowerCase("he-IL");
      if (seenCity.has(key)) continue;
      seenCity.add(key);
      deliveryCities.push(trimmed);
    }
  }
  deliveryCities.sort((a, b) => a.localeCompare(b, "he-IL"));

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
        about: tenant.about,
        businessType: tenant.businessType,
        coverImage: tenant.coverImage,
        themeId: tenant.themeId,
      }}
      branch={
        branch
          ? {
              address: branch.address,
              phone: branch.phone,
              status: branch.status,
              deliveryFee: branch.deliveryFee,
              serviceFee: branch.serviceFee,
              minOrder: branch.minOrder,
              hours: (branch.hours ?? {}) as Record<
                string,
                { open: string; close: string; active: boolean }
              >,
              busyEtaBoostMinutes: branch.busyEtaBoostMinutes,
            }
          : null
      }
      ratingSummary={ratingSummary}
      deliveryEta={deliveryEta}
      categories={categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, imageUrl: c.imageUrl }))}
      allCategories={allCategories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, imageUrl: c.imageUrl }))}
      menuItems={menuItems.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        name: i.name,
        description: i.description,
        basePrice: i.basePrice,
        artType: i.artType,
        images: i.images,
        tags: i.tags,
        featured: i.featured,
      }))}
      featuredBadgeLabel={tenant.featuredBadgeLabel}
      notices={notices.map((n) => ({
        id: n.id,
        scope: n.scope,
        categoryId: n.categoryId,
        itemId: n.itemId,
        kind: n.kind,
        title: n.title,
        body: n.body,
      }))}
      deals={activeDeals
        .filter((d) =>
          d.slots.every((s) => s.choices.some((c) => c.item.available)),
        )
        .map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          imageUrl: d.imageUrl,
          fixedPrice: d.fixedPrice,
          itemImages: d.slots
            .flatMap((s) => s.choices.map((c) => c.item.images[0]))
            .filter((x): x is string => !!x)
            .slice(0, 3),
        }))}
      popular={popularSerialized}
      recentOrders={recentOrdersSerialized}
      deliveryCities={deliveryCities}
      pickupEnabled={tenant.pickupEnabled}
      bannerCampaign={bannerCampaign}
      hasCustomerSession={session?.type === "customer"}
      pendingReviewOrderId={pendingReview?.id ?? null}
      aiAdvisorEnabled={
        tenant.aiAdvisorEnabled &&
        ((tenant.aiProvider === "claude" && !!tenant.aiClaudeApiKey) ||
          (tenant.aiProvider === "gemini" && !!tenant.aiGeminiApiKey))
      }
    />
  );
}
