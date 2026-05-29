import { OrderStatus, Prisma } from "@prisma/client";
import { handler, apiJson } from "@/lib/api-response";
import { requireCourier } from "@/lib/auth/courier-session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const session = await requireCourier();
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? "active";

  const where: Prisma.OrderWhereInput = {
    courierId: session.courierId,
    status:
      scope === "history"
        ? { in: [OrderStatus.delivered, OrderStatus.cancelled, OrderStatus.refunded] }
        : { in: [OrderStatus.out_for_delivery] },
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: scope === "history" ? 30 : 20,
    include: {
      deliveryAddress: true,
      items: { select: { id: true, nameSnapshot: true, quantity: true } },
    },
  });

  return apiJson({
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      method: o.method,
      total: o.total,
      payment_method: o.paymentMethod,
      payment_status: o.paymentStatus,
      customer_name:
        `${o.customerFirstNameSnap ?? ""} ${o.customerLastNameSnap ?? ""}`.trim() || "לקוח",
      customer_phone: o.customerPhoneSnap,
      customer_notes: o.customerNotes,
      delivery_notes: o.deliveryNotes,
      created_at: o.createdAt.toISOString(),
      ready_at: o.readyAt?.toISOString() ?? null,
      courier_picked_up_at: o.courierPickedUpAt?.toISOString() ?? null,
      delivered_at: o.deliveredAt?.toISOString() ?? null,
      address: o.deliveryAddress
        ? {
            street: o.deliveryAddress.street,
            city: o.deliveryAddress.city,
            apartment: o.deliveryAddress.apartment,
            floor: o.deliveryAddress.floor,
            entrance: o.deliveryAddress.entrance,
            notes: o.deliveryAddress.notes,
            lat: o.deliveryAddress.lat ? Number(o.deliveryAddress.lat) : null,
            lng: o.deliveryAddress.lng ? Number(o.deliveryAddress.lng) : null,
          }
        : null,
      items_count: o.items.length,
    })),
  });
});
