import { handler, apiJson } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { OrderStatus, OrderMethod, Prisma } from "@prisma/client";
import { ORDER_INCLUDE, serializeOrder } from "@/lib/orders-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `pending` is included so the Kanban's "ממתינות לקבלה" column can
// show orders awaiting merchant confirmation — kiosk cash orders
// waiting for a cashier to take the cash, or card orders whose Grow
// callback hasn't landed. The kitchen / KDS screen filters `pending`
// out client-side so the kitchen never pre-cooks an unconfirmed order.
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
  const method = url.searchParams.get("method");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const search = url.searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") || "30", 10)));

  const where: Prisma.OrderWhereInput = { tenantId: session.tenantId };

  if (status === "active") {
    where.status = { in: ACTIVE_STATUSES };
    where.kanbanHiddenAt = null;
    // Hide card orders that are still waiting for Grow to confirm
    // payment. Cash-pending stays visible — the merchant needs to
    // see it so they can press "מזומן התקבל" once the kiosk customer
    // hands over the cash.
    where.NOT = {
      AND: [
        { status: OrderStatus.pending },
        { paymentMethod: { not: "cash" } },
      ],
    };
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

  // One sweep across both audit logs to mark which orders already had a
  // review reminder delivered — drives the "שלח ביקורת עכשיו" button on
  // the history row. Cheaper than N+1 per-order lookups.
  const orderIds = orders.map((o) => o.id);
  const [smsSent, emailSent] = orderIds.length
    ? await Promise.all([
        prisma.smsLog.findMany({
          where: {
            tenantId: session.tenantId,
            kind: "review_reminder",
            refKind: "order",
            refId: { in: orderIds },
            status: "sent",
          },
          select: { refId: true },
        }),
        prisma.emailLog.findMany({
          where: {
            tenantId: session.tenantId,
            kind: "review_reminder",
            refKind: "order",
            refId: { in: orderIds },
            status: "sent",
          },
          select: { refId: true },
        }),
      ])
    : [[], []];
  const remindedIds = new Set<string>([
    ...smsSent.map((s) => s.refId).filter((v): v is string => !!v),
    ...emailSent.map((s) => s.refId).filter((v): v is string => !!v),
  ]);

  return apiJson({
    orders: orders.map((o) => ({
      ...serializeOrder(o),
      review_reminder_sent: remindedIds.has(o.id),
    })),
    meta: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
  });
});
