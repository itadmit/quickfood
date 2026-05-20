import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";

/**
 * Order status state machine. Defines which transitions are legal.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["in_oven", "ready", "cancelled"],
  in_oven: ["ready", "cancelled"],
  ready: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export class OrderTransitionError extends Error {
  constructor(public from: OrderStatus, public to: OrderStatus) {
    super(`Illegal order transition: ${from} → ${to}`);
    this.name = "OrderTransitionError";
  }
}

/**
 * Advance an order's status, validate the transition, record an OrderEvent,
 * fire-and-forget webhook dispatch.
 */
export async function advanceStatus(
  orderId: string,
  to: OrderStatus,
  options?: { courierId?: string; reason?: string; changedBy?: string },
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("order_not_found");

  if (!canTransition(order.status, to)) {
    throw new OrderTransitionError(order.status, to);
  }

  const now = new Date();
  const updates: Record<string, unknown> = { status: to };
  if (options?.courierId) updates.courierId = options.courierId;
  if (to === "confirmed") updates.confirmedAt = now;
  if (to === "ready") updates.readyAt = now;
  if (to === "delivered") updates.deliveredAt = now;
  if (to === "cancelled") updates.cancelledAt = now;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: updates,
  });

  await prisma.orderEvent.create({
    data: {
      orderId,
      type: "status_changed",
      payload: {
        from: order.status,
        to,
        changed_at: now.toISOString(),
        changed_by: options?.changedBy,
        reason: options?.reason,
      },
    },
  });

  // Fire webhooks (best-effort, non-blocking)
  if (to === "cancelled") {
    void dispatchWebhook({
      tenantId: order.tenantId,
      eventType: "order.cancelled",
      payload: {
        order_id: orderId,
        reason: options?.reason,
        cancelled_at: now.toISOString(),
      },
    });
  } else {
    void dispatchWebhook({
      tenantId: order.tenantId,
      eventType: "order.status_changed",
      payload: {
        order_id: orderId,
        from: order.status,
        to,
        changed_at: now.toISOString(),
      },
    });
  }

  return updated;
}
