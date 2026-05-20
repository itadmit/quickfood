import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

export type Range = "today" | "yesterday" | "7d" | "30d" | "custom";

export function rangeBounds(range: Range, custom?: { from?: Date; to?: Date }) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case "today": {
      return { from: today, to: now, previousFrom: dayBack(today, 1), previousTo: today };
    }
    case "yesterday": {
      const y = dayBack(today, 1);
      return { from: y, to: today, previousFrom: dayBack(y, 1), previousTo: y };
    }
    case "7d": {
      const f = dayBack(today, 6);
      return {
        from: f,
        to: now,
        previousFrom: dayBack(f, 7),
        previousTo: f,
      };
    }
    case "30d": {
      const f = dayBack(today, 29);
      return {
        from: f,
        to: now,
        previousFrom: dayBack(f, 30),
        previousTo: f,
      };
    }
    case "custom": {
      const f = custom?.from ?? dayBack(today, 6);
      const t = custom?.to ?? now;
      const span = t.getTime() - f.getTime();
      return {
        from: f,
        to: t,
        previousFrom: new Date(f.getTime() - span),
        previousTo: f,
      };
    }
  }
}

function dayBack(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n);
}

const TERMINAL_STATUSES = ["delivered", "ready", "out_for_delivery"] as const;

export async function summary(tenantId: string, range: Range) {
  const { from, to, previousFrom, previousTo } = rangeBounds(range);

  const [current, previous] = await Promise.all([
    aggregateBucket(tenantId, from, to),
    aggregateBucket(tenantId, previousFrom, previousTo),
  ]);

  return {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    orders: { count: current.count, delta: pctDelta(current.count, previous.count) },
    revenue: { value: current.revenue, delta: pctDelta(current.revenue, previous.revenue) },
    avg_order: { value: current.avgOrder, delta: pctDelta(current.avgOrder, previous.avgOrder) },
    avg_prep: { value: current.avgPrepMinutes, delta: pctDelta(current.avgPrepMinutes, previous.avgPrepMinutes) },
  };
}

async function aggregateBucket(tenantId: string, from: Date, to: Date) {
  const where: Prisma.OrderWhereInput = {
    tenantId,
    createdAt: { gte: from, lt: to },
    status: { in: ["delivered", "ready", "out_for_delivery"] },
  };
  const rows = await prisma.order.findMany({
    where,
    select: { total: true, createdAt: true, confirmedAt: true, readyAt: true },
  });
  const count = rows.length;
  const revenue = rows.reduce((acc, r) => acc + r.total, 0);
  const avgOrder = count > 0 ? Math.round(revenue / count) : 0;
  const prepMins = rows
    .filter((r) => r.readyAt && r.confirmedAt)
    .map((r) => (r.readyAt!.getTime() - r.confirmedAt!.getTime()) / 60_000);
  const avgPrepMinutes = prepMins.length > 0 ? Math.round(prepMins.reduce((a, b) => a + b, 0) / prepMins.length) : 0;
  return { count, revenue, avgOrder, avgPrepMinutes };
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function hourly(tenantId: string, range: Range) {
  const { from, to, previousFrom, previousTo } = rangeBounds(range);
  const [cur, prev] = await Promise.all([
    bucketByHour(tenantId, from, to),
    bucketByHour(tenantId, previousFrom, previousTo),
  ]);
  return { current: cur, previous: prev };
}

async function bucketByHour(tenantId: string, from: Date, to: Date): Promise<number[]> {
  const rows = await prisma.order.findMany({
    where: {
      tenantId,
      createdAt: { gte: from, lt: to },
      status: { in: [...TERMINAL_STATUSES] },
    },
    select: { createdAt: true },
  });
  const buckets = new Array(24).fill(0);
  for (const r of rows) {
    const h = r.createdAt.getHours();
    buckets[h]++;
  }
  return buckets;
}

export async function topItems(tenantId: string, range: Range, limit = 5) {
  const { from, to } = rangeBounds(range);

  const rows = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: {
      order: {
        tenantId,
        createdAt: { gte: from, lt: to },
        status: { in: [...TERMINAL_STATUSES] },
      },
      menuItemId: { not: null },
    },
    _sum: { quantity: true, totalPrice: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const ids = rows.map((r) => r.menuItemId!).filter(Boolean);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, artType: true },
  });
  const itemsById = new Map(items.map((i) => [i.id, i]));

  return rows.map((r) => {
    const item = r.menuItemId ? itemsById.get(r.menuItemId) : null;
    return {
      item_id: r.menuItemId,
      name: item?.name ?? "פריט שנמחק",
      art_type: item?.artType ?? null,
      count: r._sum.quantity ?? 0,
      revenue: r._sum.totalPrice ?? 0,
    };
  });
}
