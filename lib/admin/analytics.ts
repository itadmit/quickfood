import { prisma } from "@/lib/db/client";
import { rangeBounds, type Range } from "@/lib/analytics";

const TERMINAL = ["delivered", "ready", "out_for_delivery"] as const;
const TZ = "Asia/Jerusalem";

function pctDelta(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

function dayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

function buildDaySeries(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (cur <= to) {
    days.push(dayKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return [...new Set(days)];
}

export interface PlatformOverview {
  range: Range;
  from: string;
  to: string;
  gmv: { value: number; delta: number };
  orders: { value: number; delta: number };
  activeTenants: { value: number; delta: number };
  newSignups: { value: number; delta: number };
  avgGmvPerActive: number;
  trend: { date: string; gmv: number; orders: number }[];
  leaderboard: { id: string; name: string; slug: string; gmv: number; orders: number }[];
}

export async function platformOverview(range: Range): Promise<PlatformOverview> {
  const { from, to, previousFrom, previousTo } = rangeBounds(range);

  const [curOrders, prevOrders, curSignups, prevSignups] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: from, lt: to }, status: { in: [...TERMINAL] } },
      select: { tenantId: true, total: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: previousFrom, lt: previousTo }, status: { in: [...TERMINAL] } },
      select: { tenantId: true, total: true },
    }),
    prisma.tenant.count({ where: { createdAt: { gte: from, lt: to } } }),
    prisma.tenant.count({ where: { createdAt: { gte: previousFrom, lt: previousTo } } }),
  ]);

  const gmv = curOrders.reduce((a, r) => a + r.total, 0);
  const prevGmv = prevOrders.reduce((a, r) => a + r.total, 0);
  const orders = curOrders.length;
  const prevOrdersCount = prevOrders.length;

  const curActive = new Set(curOrders.map((r) => r.tenantId));
  const prevActive = new Set(prevOrders.map((r) => r.tenantId));

  const byTenant = new Map<string, { gmv: number; orders: number }>();
  for (const r of curOrders) {
    const e = byTenant.get(r.tenantId) ?? { gmv: 0, orders: 0 };
    e.gmv += r.total;
    e.orders += 1;
    byTenant.set(r.tenantId, e);
  }
  const topIds = [...byTenant.entries()].sort((a, b) => b[1].gmv - a[1].gmv).slice(0, 10);
  const tenants = topIds.length
    ? await prisma.tenant.findMany({
        where: { id: { in: topIds.map(([id]) => id) } },
        select: { id: true, name: true, slug: true },
      })
    : [];
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));
  const leaderboard = topIds.map(([id, v]) => ({
    id,
    name: tenantMap.get(id)?.name ?? "—",
    slug: tenantMap.get(id)?.slug ?? "",
    gmv: v.gmv,
    orders: v.orders,
  }));

  const trendMap = new Map<string, { gmv: number; orders: number }>();
  for (const r of curOrders) {
    const key = dayKey(r.createdAt);
    const e = trendMap.get(key) ?? { gmv: 0, orders: 0 };
    e.gmv += r.total;
    e.orders += 1;
    trendMap.set(key, e);
  }
  const trend = buildDaySeries(from, to).map((d) => ({
    date: d,
    gmv: trendMap.get(d)?.gmv ?? 0,
    orders: trendMap.get(d)?.orders ?? 0,
  }));

  return {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    gmv: { value: gmv, delta: pctDelta(gmv, prevGmv) },
    orders: { value: orders, delta: pctDelta(orders, prevOrdersCount) },
    activeTenants: { value: curActive.size, delta: pctDelta(curActive.size, prevActive.size) },
    newSignups: { value: curSignups, delta: pctDelta(curSignups, prevSignups) },
    avgGmvPerActive: curActive.size > 0 ? Math.round(gmv / curActive.size) : 0,
    trend,
    leaderboard,
  };
}

export interface LifecycleHealth {
  totalActive: number;
  trialsEndingSoon: number;
  billingNotSetup: number;
  lowSmsCredits: number;
  churnRisk: number;
}

export async function lifecycleHealth(): Promise<LifecycleHealth> {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 86_400_000);
  const churnCutoff = new Date(now.getTime() - 14 * 86_400_000);

  const [totalActive, trialsEndingSoon, billingNotSetup, lowSmsCredits, recent, ever] =
    await Promise.all([
      prisma.tenant.count({ where: { status: "active" } }),
      prisma.tenant.count({ where: { trialEndsAt: { gte: now, lte: in3Days } } }),
      prisma.tenant.count({ where: { status: "active", billingSetupCompletedAt: null } }),
      prisma.tenant.count({ where: { smsCreditsRemaining: { lt: 20 } } }),
      prisma.order.findMany({
        where: { createdAt: { gte: churnCutoff } },
        distinct: ["tenantId"],
        select: { tenantId: true },
      }),
      prisma.order.findMany({ distinct: ["tenantId"], select: { tenantId: true } }),
    ]);

  const recentSet = new Set(recent.map((r) => r.tenantId));
  const churnRisk = ever.filter((r) => !recentSet.has(r.tenantId)).length;

  return { totalActive, trialsEndingSoon, billingNotSetup, lowSmsCredits, churnRisk };
}
