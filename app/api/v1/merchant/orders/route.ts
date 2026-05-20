import { handler, apiJson } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { OrderStatus, Prisma } from "@prisma/client";
import { fullName } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.pending,
  OrderStatus.confirmed,
  OrderStatus.preparing,
  OrderStatus.in_oven,
  OrderStatus.ready,
  OrderStatus.out_for_delivery,
];

export const GET = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) {
    return apiJson({ orders: [], meta: { total: 0, page: 1, per_page: 0 } });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") || "30", 10)));

  const where: Prisma.OrderWhereInput = { tenantId: session.tenantId };
  if (status === "active") {
    where.status = { in: ACTIVE_STATUSES };
  } else if (status && (Object.values(OrderStatus) as string[]).includes(status)) {
    where.status = status as OrderStatus;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.order.count({ where }),
  ]);

  return apiJson({
    orders: orders.map(serializeOrder),
    meta: { total, page, per_page: perPage },
  });
});

type OrderWithIncludes = Prisma.OrderGetPayload<{
  include: {
    items: true;
    customer: { select: { id: true; firstName: true; lastName: true; phone: true } };
  };
}>;

function serializeOrder(o: OrderWithIncludes) {
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
    tip: o.tip,
    discount: o.discount,
    total: o.total,
    payment_method: o.paymentMethod,
    payment_status: o.paymentStatus,
    customer_notes: o.customerNotes,
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
