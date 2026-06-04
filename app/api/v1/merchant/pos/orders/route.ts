import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POS order lookup — by order number (full or prefix). Scoped to the
 * tenant. Returns up to 20 hits ordered by most-recent.
 */
export const GET = handler(async (req: Request) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return apiJson({ orders: [] });

  const orders = await prisma.order.findMany({
    where: {
      tenantId: session.tenantId,
      number: { contains: q, mode: "insensitive" },
    },
    select: {
      id: true,
      number: true,
      total: true,
      paymentStatus: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return apiJson({
    orders: orders.map((o) => ({
      id: o.id,
      number: o.number,
      total: o.total,
      payment_status: o.paymentStatus,
      status: o.status,
      created_at: o.createdAt.toISOString(),
    })),
  });
});
