import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Broad customer search for the POS - by phone fragment or name. Unlike
 * the merchant Cmd+K palette this does NOT require prior orders at this
 * tenant: a brand-new walk-in can be attached to a sale, and any future
 * order links back to them. Returns up to 20 results.
 */
export const GET = handler(async (req: Request) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return apiJson({ customers: [] });

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { phone: { contains: q } },
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      _count: { select: { orders: { where: { tenantId: session.tenantId } } } },
    },
    take: 20,
    orderBy: [{ firstName: "asc" }],
  });

  return apiJson({
    customers: customers.map((c) => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(" "),
      phone: c.phone,
      orders_count: c._count.orders,
    })),
  });
});
