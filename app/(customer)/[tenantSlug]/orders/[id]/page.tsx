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

  const order = await prisma.order.findFirst({
    where: { id, tenantId: tenant.id },
    include: { items: true, branch: { select: { phone: true, address: true } } },
  });
  if (!order) notFound();

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
        })),
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
    />
  );
}
