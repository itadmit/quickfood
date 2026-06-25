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

// Single source of truth for the option shape exposed to clients (order
// drawer, receipt, kanban, kitchen). Keeps `half` so split pizzas render
// "(חצי א׳/ב׳)" everywhere, and drops internal ids (group_id/option_id).
export function serializeSelectedOptions(
  raw: unknown,
): Array<{ name: string; price_delta: number; half?: "left" | "right"; group_name?: string }> {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .map((o) => {
      const name = typeof o?.name === "string" ? o.name : null;
      if (!name) return null;
      const priceDelta = Number(o?.price_delta ?? 0) || 0;
      const half = o?.half === "left" || o?.half === "right" ? o.half : undefined;
      const groupName = typeof o?.group_name === "string" && o.group_name ? o.group_name : undefined;
      return {
        name,
        price_delta: priceDelta,
        ...(half ? { half } : {}),
        ...(groupName ? { group_name: groupName } : {}),
      };
    })
    .filter(
      (
        o,
      ): o is { name: string; price_delta: number; half?: "left" | "right"; group_name?: string } =>
        o !== null,
    );
}

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
      options: serializeSelectedOptions(it.selectedOptions),
      notes: it.notes,
      // Kitchen prep state - without this the kitchen display's SSE refresh
      // rebuilds every item with prepared_at=null and wipes the cook's tick.
      prepared_at: it.preparedAt?.toISOString() ?? null,
    })),
  };
}
