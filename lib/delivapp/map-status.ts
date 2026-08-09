import { OrderStatus } from "@prisma/client";

/**
 * DelivApp courier status codes (from their webhook `delivery_status` field):
 *   1 = AcceptedByCarrier
 *   2 = CourierAssociated
 *   3 = CourierArrivedToPickup
 *   4 = OrderPickedUp
 *   5 = OrderDelivering
 *   6 = CourierArrivedToDropOff
 *   7 = OrderDelivered
 *   8 = OrderCanceled
 *
 * We only force a local QuickFood status transition for the codes with an
 * unambiguous equivalent; the rest are recorded on `Order.delivAppStatus` for
 * visibility without touching the order's own lifecycle. The webhook handler
 * additionally guards every transition through the order state machine, so an
 * out-of-order code can never illegally advance an order.
 */
export const DELIVAPP_STATUS_LABEL: Record<number, string> = {
  1: "AcceptedByCarrier",
  2: "CourierAssociated",
  3: "CourierArrivedToPickup",
  4: "OrderPickedUp",
  5: "OrderDelivering",
  6: "CourierArrivedToDropOff",
  7: "OrderDelivered",
  8: "OrderCanceled",
};

export function mapDelivAppStatus(code: number): OrderStatus | null {
  switch (code) {
    case 4: // picked up by the courier
    case 5: // en route to the customer
    case 6: // arrived at drop-off
      return OrderStatus.out_for_delivery;
    case 7:
      return OrderStatus.delivered;
    case 8:
      return OrderStatus.cancelled;
    default:
      // 1/2/3 - courier acquired/associated/arrived-to-pickup. No local
      // lifecycle change; we just store the numeric code.
      return null;
  }
}
