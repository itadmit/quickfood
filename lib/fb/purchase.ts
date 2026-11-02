import type { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";

export function purchaseEligible(order: {
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
}) {
  if (["cancelled", "refunded"].includes(order.status)) return false;
  if (["failed", "refunded"].includes(order.paymentStatus)) return false;
  // Cash is a purchase on merchant acceptance; online payments require capture.
  if (order.paymentMethod === "cash") return order.status !== "pending";
  return order.paymentStatus === "paid";
}
