import { handler, apiJson } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { OrderStatus, OrderMethod, Prisma } from "@prisma/client";
import { ORDER_INCLUDE, serializeOrder } from "@/lib/orders-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `pending` is intentionally excluded. The only path that creates an
// order in that state is a card payment that hasn't received the Grow
// callback yet — so the order isn't real for the merchant until
// payment confirms (callback flips it to `confirmed`). Showing it in
// the kitchen / active list pre-payment would pre-cook unpaid orders
// and inflate KPIs.
const ACTIVE_STATUSES: OrderStatus[] = [
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
  const method = url.searchParams.get("method");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const search = url.searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") || "30", 10)));

  const where: Prisma.OrderWhereInput = { tenantId: session.tenantId };

  if (status === "active") {
    where.status = { in: ACTIVE_STATUSES };
  } else if (status && (Object.values(OrderStatus) as string[]).includes(status)) {
    where.status = status as OrderStatus;
  }

  if (method && (Object.values(OrderMethod) as string[]).includes(method)) {
    where.method = method as OrderMethod;
  }

  // Date window — `from` / `to` are ISO date strings (YYYY-MM-DD or full
  // ISO). `to` is treated as end-of-day so callers can pass a plain date.
  if (from || to) {
    const range: Prisma.DateTimeFilter = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) range.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(to)) d.setUTCHours(23, 59, 59, 999);
        range.lte = d;
      }
    }
    if (range.gte || range.lte) where.createdAt = range;
  }

  // Free-text search: order number prefix (case-insensitive), phone
  // suffix (last 4-7 digits is the common entry), or customer name.
  if (search) {
    const phoneDigits = search.replace(/\D/g, "");
    where.OR = [
      { number: { contains: search, mode: "insensitive" } },
      { customerFirstNameSnap: { contains: search, mode: "insensitive" } },
      { customerLastNameSnap: { contains: search, mode: "insensitive" } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
      ...(phoneDigits.length >= 3
        ? [
            { customerPhoneSnap: { contains: phoneDigits } },
            { customer: { phone: { contains: phoneDigits } } },
          ]
        : []),
    ];
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
    meta: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
  });
});
