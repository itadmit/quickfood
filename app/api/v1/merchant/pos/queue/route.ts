import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kiosk orders that the customer chose to pay at the counter. Scoped to
 * the cashier's pinned branch when present, otherwise the tenant's
 * primary branch (owner/manager training fallback).
 */
export const GET = handler(async (req: Request) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const url = new URL(req.url);
  const countOnly = url.searchParams.get("count_only") === "1";

  const user = await prisma.merchantUser.findUnique({
    where: { id: session.userId },
    select: { branchId: true },
  });
  let branchId = user?.branchId ?? null;
  if (!branchId) {
    const primary = await prisma.branch.findFirst({
      where: { tenantId: session.tenantId, isPrimary: true },
      select: { id: true },
    });
    branchId = primary?.id ?? null;
  }

  const where = {
    tenantId: session.tenantId,
    branchId: branchId ?? undefined,
    source: "kiosk" as const,
    paymentMethod: "cash" as const,
    paymentStatus: "pending" as const,
    status: "pending" as const,
  };

  if (countOnly) {
    const count = await prisma.order.count({ where });
    return apiJson({ count });
  }

  const rows = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      number: true,
      total: true,
      createdAt: true,
      customerPhoneSnap: true,
      customerFirstNameSnap: true,
      customerLastNameSnap: true,
      items: { select: { quantity: true } },
    },
    take: 50,
  });

  return apiJson({
    orders: rows.map((o) => ({
      id: o.id,
      number: o.number,
      total: o.total,
      created_at: o.createdAt.toISOString(),
      item_count: o.items.reduce((s, i) => s + i.quantity, 0),
      customer_phone: o.customerPhoneSnap,
      customer_name: [o.customerFirstNameSnap, o.customerLastNameSnap]
        .filter(Boolean)
        .join(" ") || null,
    })),
  });
});
