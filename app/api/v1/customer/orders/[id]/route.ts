import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      tenant: { select: { id: true, slug: true, name: true, themeId: true, logoLetter: true } },
      branch: { select: { name: true, address: true, phone: true } },
      deliveryAddress: true,
      courier: { select: { id: true, name: true, phone: true, ratingAvg: true } },
    },
  });
  if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

  // Visibility: owner customer or guest with matching phone — for MVP, any
  // logged-in customer can view their own; guest orders are public-by-id
  // (UUIDv4 is unguessable enough for MVP).
  const session = await getSession();
  if (session?.type === "customer" && order.customerId && order.customerId !== session.userId) {
    return apiError("forbidden", "אין הרשאה לצפות בהזמנה זו", 403);
  }

  return apiJson({
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      method: order.method,
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      service_fee: order.serviceFee,
      tip: order.tip,
      discount: order.discount,
      total: order.total,
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      customer_notes: order.customerNotes,
      delivery_notes: order.deliveryNotes,
      created_at: order.createdAt.toISOString(),
      confirmed_at: order.confirmedAt?.toISOString() ?? null,
      ready_at: order.readyAt?.toISOString() ?? null,
      delivered_at: order.deliveredAt?.toISOString() ?? null,
      estimated_ready_at: order.estimatedReadyAt?.toISOString() ?? null,
      estimated_delivery_at: order.estimatedDeliveryAt?.toISOString() ?? null,
      tenant: order.tenant,
      branch: order.branch,
      delivery_address: order.deliveryAddress,
      courier: order.courier,
      items: order.items.map((it) => ({
        id: it.id,
        name: it.nameSnapshot,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        total_price: it.totalPrice,
        size: it.sizeSnapshot,
        options: it.selectedOptions,
        notes: it.notes,
      })),
    },
  });
});
