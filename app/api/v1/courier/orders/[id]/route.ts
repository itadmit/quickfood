import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireCourier } from "@/lib/auth/courier-session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireCourier();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      deliveryAddress: true,
      items: true,
      branch: { select: { name: true, phone: true, address: true, lat: true, lng: true } },
    },
  });
  if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
  if (order.courierId !== session.courierId) {
    return apiError("forbidden", "ההזמנה אינה משויכת לך", 403);
  }

  return apiJson({
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      method: order.method,
      total: order.total,
      subtotal: order.subtotal,
      delivery_fee: order.deliveryFee,
      tip: order.tip,
      payment_method: order.paymentMethod,
      payment_status: order.paymentStatus,
      cash_collected: order.cashCollected,
      proof_photo_url: order.proofPhotoUrl,
      customer_name:
        `${order.customerFirstNameSnap ?? ""} ${order.customerLastNameSnap ?? ""}`.trim() || "לקוח",
      customer_phone: order.customerPhoneSnap,
      customer_notes: order.customerNotes,
      delivery_notes: order.deliveryNotes,
      created_at: order.createdAt.toISOString(),
      ready_at: order.readyAt?.toISOString() ?? null,
      courier_picked_up_at: order.courierPickedUpAt?.toISOString() ?? null,
      delivered_at: order.deliveredAt?.toISOString() ?? null,
      branch: order.branch
        ? {
            name: order.branch.name,
            phone: order.branch.phone,
            address: order.branch.address,
            lat: order.branch.lat ? Number(order.branch.lat) : null,
            lng: order.branch.lng ? Number(order.branch.lng) : null,
          }
        : null,
      address: order.deliveryAddress
        ? {
            street: order.deliveryAddress.street,
            city: order.deliveryAddress.city,
            apartment: order.deliveryAddress.apartment,
            floor: order.deliveryAddress.floor,
            entrance: order.deliveryAddress.entrance,
            notes: order.deliveryAddress.notes,
            lat: order.deliveryAddress.lat ? Number(order.deliveryAddress.lat) : null,
            lng: order.deliveryAddress.lng ? Number(order.deliveryAddress.lng) : null,
          }
        : null,
      items: order.items.map((it) => ({
        id: it.id,
        name: it.nameSnapshot,
        size: it.sizeSnapshot,
        quantity: it.quantity,
        notes: it.notes,
      })),
    },
  });
});
