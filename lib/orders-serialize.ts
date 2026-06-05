import type { Prisma } from "@prisma/client";
import { fullName } from "@/lib/format";

export type OrderWithIncludes = Prisma.OrderGetPayload<{
  include: {
    items: true;
    customer: { select: { id: true; firstName: true; lastName: true; phone: true } };
    review: { select: { id: true } };
  };
}>;

export const ORDER_INCLUDE = {
  items: true,
  customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
  // 1:1 - null when the customer hasn't rated yet. Drives the
  // "send review now" button on the merchant's Orders History page
  // (button hidden when a review row already exists).
  review: { select: { id: true } },
} satisfies Prisma.OrderInclude;

export function serializeOrder(o: OrderWithIncludes) {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    method: o.method,
    customer: o.customer
      ? {
          id: o.customer.id,
          first_name: o.customer.firstName,
          last_name: o.customer.lastName,
          name: fullName(o.customer.firstName, o.customer.lastName),
          phone: o.customer.phone,
        }
      : null,
    customer_first_name: o.customerFirstNameSnap,
    customer_last_name: o.customerLastNameSnap,
    customer_name: fullName(o.customerFirstNameSnap, o.customerLastNameSnap) || null,
    customer_phone: o.customerPhoneSnap,
    subtotal: o.subtotal,
    delivery_fee: o.deliveryFee,
    service_fee: o.serviceFee,
    cutlery_count: o.cutleryCount,
    cutlery_fee: o.cutleryFee,
    tip: o.tip,
    discount: o.discount,
    total: o.total,
    payment_method: o.paymentMethod,
    payment_status: o.paymentStatus,
    customer_notes: o.customerNotes,
    has_review: !!o.review,
    kanban_hidden_at: o.kanbanHiddenAt?.toISOString() ?? null,
    created_at: o.createdAt.toISOString(),
    confirmed_at: o.confirmedAt?.toISOString() ?? null,
    items: o.items.map((it) => ({
      id: it.id,
      name: it.nameSnapshot,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      total_price: it.totalPrice,
      size: it.sizeSnapshot,
      options: it.selectedOptions,
      notes: it.notes,
    })),
  };
}
