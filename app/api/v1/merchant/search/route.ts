import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { fullName } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Global merchant search — Cmd+K palette.
 * Scopes: orders (by number/customer name/phone), menu items (by name), customers.
 */
export const GET = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return apiJson({ orders: [], items: [], customers: [] });
  }

  const [orders, items, customers] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenantId: session.tenantId,
        OR: [
          { number: { contains: q, mode: "insensitive" } },
          { customerFirstNameSnap: { contains: q, mode: "insensitive" } },
          { customerLastNameSnap: { contains: q, mode: "insensitive" } },
          { customerPhoneSnap: { contains: q } },
          { customer: { firstName: { contains: q, mode: "insensitive" } } },
          { customer: { lastName: { contains: q, mode: "insensitive" } } },
          { customer: { phone: { contains: q } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        total: true,
        status: true,
        customerFirstNameSnap: true,
        customerLastNameSnap: true,
        customer: { select: { firstName: true, lastName: true } },
        createdAt: true,
      },
    }),
    prisma.menuItem.findMany({
      where: {
        tenantId: session.tenantId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      take: 5,
      select: { id: true, name: true, basePrice: true, available: true, artType: true },
    }),
    prisma.customer.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
        orders: { some: { tenantId: session.tenantId } },
      },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        _count: { select: { orders: { where: { tenantId: session.tenantId } } } },
      },
    }),
  ]);

  return apiJson({
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      total: o.total,
      status: o.status,
      customer:
        fullName(o.customer?.firstName, o.customer?.lastName) ||
        fullName(o.customerFirstNameSnap, o.customerLastNameSnap) ||
        "אורח",
      created_at: o.createdAt.toISOString(),
    })),
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      base_price: i.basePrice,
      available: i.available,
      art_type: i.artType,
    })),
    customers: customers.map((c) => ({
      id: c.id,
      name: fullName(c.firstName, c.lastName),
      first_name: c.firstName,
      last_name: c.lastName,
      phone: c.phone,
      orders_count: c._count.orders,
    })),
  });
});
