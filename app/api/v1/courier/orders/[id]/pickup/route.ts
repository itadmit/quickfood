import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireCourier } from "@/lib/auth/courier-session";
import { prisma } from "@/lib/db/client";
import { notifyOrderCustomer } from "@/lib/orders/notify-order-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireCourier();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { courierId: true, status: true, courierPickedUpAt: true },
  });
  if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
  if (order.courierId !== session.courierId) {
    return apiError("forbidden", "ההזמנה אינה משויכת לך", 403);
  }
  if (order.status !== "out_for_delivery") {
    return apiError("invalid_state", "ההזמנה לא במצב יציאה למשלוח", 409);
  }
  if (order.courierPickedUpAt) {
    return apiJson({ ok: true, already: true });
  }

  await prisma.order.update({
    where: { id },
    data: { courierPickedUpAt: new Date() },
  });
  await prisma.courier.update({
    where: { id: session.courierId },
    data: { status: "on_delivery", currentOrderId: id, lastSeenAt: new Date() },
  });
  await prisma.orderEvent.create({
    data: {
      orderId: id,
      type: "courier_picked_up",
      payload: { courier_id: session.courierId, ts: new Date().toISOString() },
    },
  });
  void notifyOrderCustomer(id, "on_the_way").catch((err) => {
    console.error("[notify] customer on the way failed", err);
  });
  return apiJson({ ok: true });
});
