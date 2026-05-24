import { handler, apiJson } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { OrderStatus, Prisma } from "@prisma/client";
import { ORDER_INCLUDE, serializeOrder } from "@/lib/orders-serialize";

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
      include: ORDER_INCLUDE,
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
