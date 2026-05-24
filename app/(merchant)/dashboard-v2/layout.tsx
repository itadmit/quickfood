import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { SidebarV2 } from "@/components/merchant/v2/SidebarV2";
import { TopbarV2 } from "@/components/merchant/v2/TopbarV2";

/**
 * V2 dashboard shell — sandbox for the bold yellow/black design.
 *
 * Lives alongside (not on top of) the production /dashboard route. The
 * sidebar links most nav items back to /dashboard/* so a merchant can
 * use the experiment as their home and still reach every existing
 * screen. Skips the BillingSetupBanner + TrialGate intentionally — this
 * is a design preview, not a load-bearing shell yet.
 */
export default async function DashboardV2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.type !== "merchant") {
    redirect("/dashboard/login");
  }

  const tenant = session.tenantId
    ? await prisma.tenant.findUnique({
        where: { id: session.tenantId },
        include: { branches: { where: { isPrimary: true }, take: 1 } },
      })
    : null;

  const user = await prisma.merchantUser.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!tenant || !user) {
    redirect("/dashboard/login");
  }

  return (
    <ThemeProvider themeId={tenant.themeId}>
      <div
        className="min-h-screen text-black flex flex-col overflow-x-hidden"
        style={{ backgroundColor: "#FFFBEC" }}
      >
        <TopbarV2
          user={user}
          tenantSlug={tenant.slug}
          tenant={{
            name: tenant.name,
            logoLetter: tenant.logoLetter,
          }}
          branch={
            tenant.branches[0]
              ? {
                  id: tenant.branches[0].id,
                  status: tenant.branches[0].status,
                }
              : null
          }
        />
        <div className="flex-1 flex">
          <SidebarV2
            tenant={{
              name: tenant.name,
              logoLetter: tenant.logoLetter,
              branchName: tenant.branches[0]?.name ?? "",
            }}
          />
          <main className="flex-1 min-w-0 p-3 lg:p-6 pb-20 lg:pb-6 overflow-x-hidden">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
