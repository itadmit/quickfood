import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { scheduleReviewReminder } from "@/lib/reviews/schedule";
import { recordOrderCommission } from "@/lib/billing-hub/commission";
import { notifyCourierAssigned, notifyCustomerDelivered } from "@/lib/courier/notify";
import { sendTenantPush } from "@/lib/merchant/push";
import { sendOrderConfirmedEmail } from "@/lib/orders/notify-customer";

/**
 * Order status state machine. Defines which transitions are legal.
 *
 * `pending → preparing` is allowed (in addition to the more granular
 * `pending → confirmed → preparing` path) so the merchant's Kanban
 * "אשר וקבל" button works on stuck-in-pending orders too. Those typically
 * happen when a card payment callback was lost — the merchant decides
 * to accept and prepare anyway. We auto-set confirmedAt when moving out
 * of pending so the timestamps stay sane.
 */
// Kitchen states (confirmed/preparing/in_oven/ready) are reversible so the
// merchant can undo a mis-tap — e.g. marked a pizza as ready by mistake and
// wants to drop it back to "בהכנה". Past out_for_delivery we lock things
// down: a courier has already been dispatched/credited, so a "back" button
// there would silently undo wallet credits + courier assignment.
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "preparing", "cancelled"],
  confirmed: ["pending", "preparing", "cancelled"],
  preparing: ["confirmed", "in_oven", "ready", "cancelled"],
  in_oven: ["preparing", "ready", "cancelled"],
  ready: ["preparing", "in_oven", "out_for_delivery", "delivered", "cancelled"],
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
    super(`Illegal order transition: ${from} ← ${to}`);
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
  options?: {
    courierId?: string;
    reason?: string;
    changedBy?: string;
    cashCollected?: number;
    proofPhotoUrl?: string;
  },
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
  if (order.status === "pending" && to !== "cancelled" && to !== "confirmed") {
    updates.confirmedAt = now;
  }
  if (to === "ready") updates.readyAt = now;
  if (to === "out_for_delivery") {
    updates.courierAssignedAt = updates.courierAssignedAt ?? now;
  }
  if (to === "delivered") {
    updates.deliveredAt = now;
    if (typeof options?.cashCollected === "number") {
      updates.cashCollected = options.cashCollected;
    }
    if (options?.proofPhotoUrl) updates.proofPhotoUrl = options.proofPhotoUrl;
  }
  if (to === "cancelled") updates.cancelledAt = now;

  const assignedCourierId = (updates.courierId as string | undefined) ?? order.courierId ?? null;

  // Wrap the order mutation + courier wallet + audit log in one
  // transaction with an optimistic lock on the previous status. Two
  // concurrent deliver calls used to both read out_for_delivery, both
  // pass canTransition, and both increment cashOnHand. The updateMany
  // filter on (id, status=order.status) is atomic — Postgres acquires
  // a row lock so only one wins; the loser sees count=0 and aborts.
  const updated = await prisma.$transaction(async (tx) => {
    const updateRes = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: updates,
    });
    if (updateRes.count === 0) {
      throw new OrderTransitionError(order.status, to);
    }

    if (to === "delivered" && assignedCourierId) {
      // Tip belongs to the courier, never to the merchant — split it
      // out of the cash bucket so settling the drawer doesn't sweep
      // the tip away. Cash orders: courier collected tip + order; pull
      // the tip into tipsOnHand, the rest is the merchant's cashOnHand.
      // Card orders with tip: merchant already received the tip via
      // Grow (it ships as a synthetic invoice line), so they owe it
      // to the courier — surface that as tipsOwed.
      let cashDelta = 0;
      let tipsOnHandDelta = 0;
      let tipsOwedDelta = 0;
      if (order.paymentMethod === "cash") {
        const collected = options?.cashCollected ?? order.total;
        tipsOnHandDelta = Math.min(order.tip, collected);
        cashDelta = Math.max(0, collected - order.tip);
      } else if (order.tip > 0) {
        tipsOwedDelta = order.tip;
      }
      const stillActive = await tx.order.findFirst({
        where: {
          courierId: assignedCourierId,
          status: "out_for_delivery",
          NOT: { id: orderId },
        },
        select: { id: true },
        orderBy: { courierAssignedAt: "asc" },
      });
      await tx.courier.update({
        where: { id: assignedCourierId },
        data: {
          deliveriesToday: { increment: 1 },
          currentOrderId: stillActive?.id ?? null,
          ...(cashDelta > 0 ? { cashOnHand: { increment: cashDelta } } : {}),
          ...(tipsOnHandDelta > 0 ? { tipsOnHand: { increment: tipsOnHandDelta } } : {}),
          ...(tipsOwedDelta > 0 ? { tipsOwed: { increment: tipsOwedDelta } } : {}),
        },
      });
    }
    if (to === "out_for_delivery" && assignedCourierId) {
      await tx.courier.update({
        where: { id: assignedCourierId },
        data: {
          status: "on_delivery",
          currentOrderId: orderId,
        },
      });
    }
    if (to === "cancelled" && order.courierId) {
      const stillActive = await tx.order.count({
        where: {
          courierId: order.courierId,
          status: { in: ["out_for_delivery"] },
          NOT: { id: orderId },
        },
      });
      if (stillActive === 0) {
        await tx.courier.update({
          where: { id: order.courierId },
          data: { currentOrderId: null },
        });
      }
    }

    await tx.orderEvent.create({
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

    return tx.order.findUnique({ where: { id: orderId } });
  });
  if (!updated) throw new Error("order_not_found");

  // When the order is delivered, kick off two billing-hub side effects:
  //   (1) queue the review reminder
  //   (2) record the 0.5% commission, but ONLY for cash orders. Card
  //       orders already fire the commission from the payment callback the
  //       moment Grow confirms (so a lazy merchant who never marks
  //       "delivered" doesn't cost us the cut). The hub dedupes on
  //       `idempotency_key: "order:<orderId>"` if both paths somehow fire.
  if (to === "delivered") {
    void scheduleReviewReminder(orderId).catch((err) => {
      console.error("[reviews] schedule failed", err);
    });
    if (order.paymentMethod === "cash") {
      void recordOrderCommission(orderId).catch((err) => {
        console.error("[commission] record failed", err);
      });
    }
    void notifyCustomerDelivered(orderId).catch((err) => {
      console.error("[courier] notify delivered failed", err);
    });
  }

  if (to === "out_for_delivery" && options?.courierId && options.courierId !== order.courierId) {
    void notifyCourierAssigned(orderId, options.courierId).catch((err) => {
      console.error("[courier] assign notify failed", err);
    });
  }

  if (order.status === "pending" && to === "confirmed") {
    void sendTenantPush(order.tenantId, {
      title: `הזמנה חדשה — ${order.number}`,
      body: `${order.total} ש"ח · ${order.method === "delivery" ? "משלוח" : "איסוף"}`,
      url: "/dashboard/orders",
      tag: `order-${orderId}`,
      requireInteraction: true,
    }).catch((err) => console.warn("[push] tenant new-order failed", err));

    void sendOrderConfirmedEmail(orderId).catch((err) =>
      console.warn("[email] order confirmed failed", err),
    );
  }

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
