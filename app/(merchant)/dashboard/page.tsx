import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { PaymentProvider } from "@prisma/client";
import { summary, hourly, topItems, type Range } from "@/lib/analytics";
import { fullName } from "@/lib/format";
import { DashboardView } from "./DashboardView";
import { DashboardViewV2 } from "@/components/merchant/v2/DashboardViewV2";
import { WoltImportModal } from "./WoltImportModal";
import { roleHome } from "@/lib/auth/merchant-access";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; wolt?: string; ack?: string; autostart?: string }>;
}) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  // Kitchen / courier roles don't get the analytics home - send them to
  // their own landing (kitchen screen / orders).
  const home = roleHome(session.role);
  if (home !== "/dashboard") redirect(home);

  const { range: raw, wolt, ack, autostart } = await searchParams;
  const allowed = ["today", "yesterday", "7d", "30d"] as const;
  type Quick = (typeof allowed)[number];
  const range: Quick = allowed.includes(raw as Quick) ? (raw as Quick) : "today";
  const apiRange: Range = range;

  const [sum, hr, items, recentOrders, tenant, merchant, menuItemCount, categoryCount, primaryBranch, paymentConfig] = await Promise.all([
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
      select: { dashboardVersion: true, logoUrl: true, about: true, cuisineType: true, name: true, acceptsCash: true },
    }),
    prisma.merchantUser.findUnique({
      where: { id: session.userId },
      select: { name: true },
    }),
    prisma.menuItem.count({ where: { tenantId: session.tenantId } }),
    prisma.menuCategory.count({ where: { tenantId: session.tenantId } }),
    prisma.branch.findFirst({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true, address: true, phone: true, minOrder: true, deliveryFee: true, hours: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.paymentProviderConfig.findUnique({
      where: { tenantId_provider: { tenantId: session.tenantId, provider: PaymentProvider.grow } },
      select: { isActive: true, credentials: true },
    }),
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

  const woltModal = wolt ? (
    <WoltImportModal
      initialUrl={decodeURIComponent(wolt)}
      initialAck={ack === "1"}
      autoStart={autostart === "1"}
    />
  ) : null;

  if (tenant?.dashboardVersion === "v2") {
    const firstName = (merchant?.name ?? "").split(/\s+/)[0] ?? "";
    return (
      <>
        {woltModal}
        <DashboardViewV2
          range={range}
          summary={sum}
          hourly={hr}
          topItems={items}
          recentOrders={recent}
          merchantFirstName={firstName}
          hasNoMenuItems={menuItemCount === 0}
          setupState={{
            brandingDone: !!(tenant?.logoUrl || tenant?.about || tenant?.cuisineType),
            categoriesDone: categoryCount > 0,
            menuItemsDone: menuItemCount > 0,
            branchId: primaryBranch?.id ?? null,
            initialStoreName: tenant?.name ?? "",
            initialCuisineType: tenant?.cuisineType ?? "",
            initialBranchName: primaryBranch?.name ?? "",
            initialBranchAddress: primaryBranch?.address ?? "",
            initialBranchPhone: primaryBranch?.phone ?? "",
            initialMinOrder: primaryBranch?.minOrder ?? 0,
            initialDeliveryFee: primaryBranch?.deliveryFee ?? 0,
            initialAcceptsCash: tenant?.acceptsCash ?? true,
            initialGrowActive: paymentConfig?.isActive ?? false,
            initialGrowUserId: ((paymentConfig?.credentials ?? {}) as { userId?: string }).userId ?? "",
            initialBranchHours: (primaryBranch?.hours ?? {}) as Record<string, { open: string; close: string; active: boolean }>,
          }}
        />
      </>
    );
  }

  return (
    <>
      {woltModal}
      <DashboardView range={range} summary={sum} hourly={hr} topItems={items} recentOrders={recent} />
    </>
  );
}
