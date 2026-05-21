import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
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
    />
  );
}
