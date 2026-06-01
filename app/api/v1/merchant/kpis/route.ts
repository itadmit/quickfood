import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live KPIs displayed in the Topbar chips:
 *  - avg_prep_minutes: avg prep time across orders that ended today
 *  - active_orders: count of non-terminal orders
 *  - couriers_total/available
 */
export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [active, couriers, completedToday] = await Promise.all([
    prisma.order.count({
      where: {
        tenantId: session.tenantId,
        status: { in: ["pending", "confirmed", "preparing", "in_oven", "ready", "out_for_delivery"] },
      },
    }),
    prisma.courier.findMany({
      where: { tenantId: session.tenantId },
      select: { status: true },
    }),
    prisma.order.findMany({
      where: {
        tenantId: session.tenantId,
        status: "delivered",
        deliveredAt: { gte: todayStart },
        confirmedAt: { not: null },
        readyAt: { not: null },
      },
      select: { confirmedAt: true, readyAt: true },
    }),
  ]);

  const prepMins = completedToday
    .filter((o) => o.readyAt && o.confirmedAt)
    .map((o) => (o.readyAt!.getTime() - o.confirmedAt!.getTime()) / 60_000);
  const avgPrep =
    prepMins.length > 0
      ? Math.round(prepMins.reduce((a, b) => a + b, 0) / prepMins.length)
      : null;

  const couriersTotal = couriers.length;
  const couriersAvailable = couriers.filter(
    (c) => c.status === "available" || c.status === "on_delivery",
  ).length;

  return apiJson({
    avg_prep_minutes: avgPrep,
    active_orders: active,
    couriers_total: couriersTotal,
    couriers_available: couriersAvailable,
  });
});
