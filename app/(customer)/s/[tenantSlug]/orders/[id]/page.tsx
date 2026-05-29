import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { getSession } from "@/lib/auth/session";
import { OrderTracking } from "@/components/customer/screens/OrderTracking";
import { verifyReviewToken } from "@/lib/reviews/token";

export const dynamic = "force-dynamic";

export default async function OrderTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug, id } = await params;
  const sp = (await searchParams) ?? {};
  const rawToken = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  // checkoutShowTracking decides whether the post-order page is a simple
  // e-commerce "thank you" receipt (default) or the full live-tracking
  // experience the restaurant can opt into in Settings → Checkout.
  const tenantSettings = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { checkoutShowTracking: true },
  });

  const order = await prisma.order.findFirst({
    where: { id, tenantId: tenant.id },
    include: {
      items: { include: { menuItem: { select: { images: true } } } },
      branch: { select: { phone: true, address: true } },
      deliveryAddress: { select: { lat: true, lng: true, street: true, city: true } },
      courier: {
        select: {
          id: true,
          name: true,
          phone: true,
          currentLat: true,
          currentLng: true,
        },
      },
    },
  });
  if (!order) notFound();

  // Last 3 visible reviews (with text) for the social-proof teaser. Kept
  // to ≥4 stars + non-empty body so the section actually says something.
  const recentReviews = await prisma.review.findMany({
    where: {
      tenantId: tenant.id,
      status: "visible",
      rating: { gte: 4 },
      text: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      rating: true,
      text: true,
      createdAt: true,
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  // Review eligibility: three independent proofs of ownership, any one of
  // which unlocks the form.
  //  1. Cookie session whose customerId matches (logged-in customer).
  //  2. Signed HMAC token in the URL (?t=…) — used by the review-reminder
  //     email and by the same-device localStorage path (the page re-loads
  //     itself with ?t= when it finds a stored token for this order).
  //  3. (client-only) localStorage holds a stored token from checkout —
  //     handled by OrderTracking.tsx on mount.
  const session = await getSession();
  const sessionMatches =
    !!session &&
    session.type === "customer" &&
    !!order.customerId &&
    order.customerId === session.userId;
  const tokenMatches = (() => {
    const decoded = verifyReviewToken(rawToken);
    return !!decoded && decoded.orderId === order.id;
  })();
  const canReview = sessionMatches || tokenMatches;

  const existingReview = canReview
    ? await prisma.review.findUnique({
        where: { orderId: order.id },
        select: {
          id: true,
          rating: true,
          text: true,
          createdAt: true,
          replyText: true,
          replyAt: true,
        },
      })
    : null;

  return (
    <OrderTracking
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      tenantLogoUrl={tenant.logoUrl}
      tenantCoverImage={tenant.coverImage}
      recentReviews={recentReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        text: r.text ?? "",
        createdAt: r.createdAt.toISOString(),
        authorName:
          [r.customer.firstName, r.customer.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || "לקוח/ה",
      }))}
      order={{
        id: order.id,
        number: order.number,
        status: order.status,
        method: order.method,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt.toISOString(),
        confirmedAt: order.confirmedAt?.toISOString() ?? null,
        readyAt: order.readyAt?.toISOString() ?? null,
        deliveredAt: order.deliveredAt?.toISOString() ?? null,
        branch: order.branch,
        deliveryLocation:
          order.deliveryAddress?.lat && order.deliveryAddress?.lng
            ? { lat: Number(order.deliveryAddress.lat), lng: Number(order.deliveryAddress.lng) }
            : null,
        courier: order.courier
          ? {
              name: order.courier.name,
              phone: order.courier.phone,
              lat: order.courier.currentLat ? Number(order.courier.currentLat) : null,
              lng: order.courier.currentLng ? Number(order.courier.currentLng) : null,
            }
          : null,
        items: order.items.map((it) => ({
          id: it.id,
          name: it.nameSnapshot,
          quantity: it.quantity,
          total: it.totalPrice,
          size: it.sizeSnapshot,
          imageUrl: it.menuItem?.images?.[0] ?? null,
        })),
        businessType: tenant.businessType,
      }}
      canReview={canReview}
      existingReview={
        existingReview
          ? {
              rating: existingReview.rating,
              text: existingReview.text,
              createdAt: existingReview.createdAt.toISOString(),
              replyText: existingReview.replyText,
              replyAt: existingReview.replyAt?.toISOString() ?? null,
            }
          : null
      }
      showTracking={tenantSettings?.checkoutShowTracking ?? false}
    />
  );
}
