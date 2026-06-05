import { OrderStatus, Prisma } from "@prisma/client";

/**
 * Card / wallet orders sit at `status=pending` + `paymentStatus=pending`
 * between order creation and the Grow callback flipping them to paid +
 * advancing them to `confirmed`. Until the callback lands they must NOT
 * appear in any merchant-facing "live" surface (Kanban active tab, KPI
 * active count, Kitchen Display Screen) - otherwise the merchant starts
 * cooking food for an order the customer might abandon mid-payment.
 *
 * Cash-pending orders stay visible: there's no payment callback for cash,
 * the merchant accepts the order and marks "מזומן התקבל" by hand.
 */
export const HIDE_UNPAID_NONCASH: Prisma.OrderWhereInput["NOT"] = {
  AND: [
    { status: OrderStatus.pending },
    { paymentMethod: { not: "cash" } },
  ],
};
