import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { summary, hourly, topItems, type Range } from "@/lib/analytics";
import { fullName } from "@/lib/format";
import { DashboardView } from "./DashboardView";
import { DashboardViewV2 } from "@/components/merchant/v2/DashboardViewV2";
import { roleHome } from "@/lib/auth/merchant-access";

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
  // Kitchen / courier roles don't get the analytics home - send them to
  // their own landing (kitchen screen / orders).
  const home = roleHome(session.role);
  if (home !== "/dashboard") redirect(home);

  const raw = (await searchParams).range;
  const allowed = ["today", "yesterday", "7d", "30d"] as const;
  type Quick = (typeof allowed)[number];
  const range: Quick = allowed.includes(raw as Quick) ? (raw as Quick) : "today";
  const apiRange: Range = range;

  const [sum, hr, items, recentOrders, tenant, merchant, menuItemCount] = await Promise.all([
    summary(session.tenantId, apiRange),
    hourly(session.tenantId, apiRange),
    topItems(session.tenantId, apiRange, 5),
    prisma.order.findMany({
      where: { tenantId: session.tenantId },
      include: { customer: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { dashboardVersion: true },
    }),
    prisma.merchantUser.findUnique({
      where: { id: session.userId },
      select: { name: true },
    }),
    prisma.menuItem.count({ where: { tenantId: session.tenantId } }),
  ]);

  const recent = recentOrders.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    method: o.method,
    total: o.total,
    customerName:
      fullName(o.customer?.firstName, o.customer?.lastName) ||
      fullName(o.customerFirstNameSnap, o.customerLastNameSnap) ||
      "אורח",
    createdAt: o.createdAt.toISOString(),
  }));

  if (tenant?.dashboardVersion === "v2") {
    const firstName = (merchant?.name ?? "").split(/\s+/)[0] ?? "";
    return (
      <DashboardViewV2
        range={range}
        summary={sum}
        hourly={hr}
        topItems={items}
        recentOrders={recent}
        merchantFirstName={firstName}
        hasNoMenuItems={menuItemCount === 0}
      />
    );
  }

  return <DashboardView range={range} summary={sum} hourly={hr} topItems={items} recentOrders={recent} />;
}
