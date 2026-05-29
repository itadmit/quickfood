import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { getSession } from "@/lib/auth/session";
import { OrderTracking } from "@/components/customer/screens/OrderTracking";

export const dynamic = "force-dynamic";

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = await params;
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

  // Review eligibility: only the logged-in customer who owns the order can
  // review. We surface (a) whether the form should show at all and (b) any
  // existing review so the UI can switch into a "thank you" state.
  const session = await getSession();
  const canReview =
    !!session &&
    session.type === "customer" &&
    !!order.customerId &&
    order.customerId === session.userId;

  const existingReview = canReview
    ? await prisma.review.findUnique({
        where: { orderId: order.id },
        select: { id: true, rating: true, text: true, createdAt: true },
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
            }
          : null
      }
      showTracking={tenantSettings?.checkoutShowTracking ?? false}
    />
  );
}
