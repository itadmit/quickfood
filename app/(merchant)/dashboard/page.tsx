import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { summary, hourly, topItems, type Range } from "@/lib/analytics";
import { DashboardView } from "./DashboardView";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const raw = (await searchParams).range;
  const allowed = ["today", "yesterday", "7d", "30d"] as const;
  type Quick = (typeof allowed)[number];
  const range: Quick = allowed.includes(raw as Quick) ? (raw as Quick) : "today";
  const apiRange: Range = range;

  const [sum, hr, items, recentOrders] = await Promise.all([
    summary(session.tenantId, apiRange),
    hourly(session.tenantId, apiRange),
    topItems(session.tenantId, apiRange, 5),
    prisma.order.findMany({
      where: { tenantId: session.tenantId },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const recent = recentOrders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    method: o.method,
    total: o.total,
    customerName: o.customer?.name || o.customerNameSnap || "אורח",
    createdAt: o.createdAt.toISOString(),
  }));

  return <DashboardView range={range} summary={sum} hourly={hr} topItems={items} recentOrders={recent} />;
}
