/**
 * Single source of truth for how an Order status is shown to the merchant:
 * Hebrew label + visual tone. Used by the V2 dashboard recent-orders list and
 * the order history so the two never drift. pending/confirmed both read as
 * "חדשה" (new) - the merchant treats an un-started order the same either way.
 */

export type OrderStatusTone =
  | "waiting"
  | "approved"
  | "idle"
  | "active"
  | "transit"
  | "done"
  | "canceled";

export const ORDER_STATUS_META: Record<string, { label: string; tone: OrderStatusTone }> = {
  pending: { label: "חדשה", tone: "waiting" },
  confirmed: { label: "חדשה", tone: "waiting" },
  preparing: { label: "בהכנה", tone: "active" },
  in_oven: { label: "בהכנה", tone: "active" },
  ready: { label: "מוכן", tone: "approved" },
  out_for_delivery: { label: "יצא למשלוח", tone: "transit" },
  delivered: { label: "נמסר", tone: "done" },
  cancelled: { label: "בוטלה", tone: "canceled" },
  canceled: { label: "בוטלה", tone: "canceled" },
  refunded: { label: "הוחזרה", tone: "canceled" },
};
