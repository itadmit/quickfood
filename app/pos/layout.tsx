import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { canAccessDashboard } from "@/lib/auth/merchant-access";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { PosShell } from "@/components/pos/PosShell";

export const dynamic = "force-dynamic";

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  if (!canAccessDashboard(session.role, "/pos")) {
    redirect("/dashboard");
  }

  // Cashier is hard-bound to their pinned branch. Owner/manager training
  // gets the primary branch — they can't switch from inside the POS today.
  const [user, primaryBranch] = await Promise.all([
    prisma.merchantUser.findUnique({
      where: { id: session.userId },
      select: { id: true, name: true, role: true, branchId: true },
    }),
    prisma.branch.findFirst({
      where: { tenantId: session.tenantId, isPrimary: true },
      select: { id: true, name: true, tenantId: true },
    }),
  ]);
  if (!user) redirect("/dashboard/login");

  let branchId = user.branchId;
  if (!branchId) branchId = primaryBranch?.id ?? null;
  if (!branchId) redirect("/dashboard");

  const [branch, tenant] = await Promise.all([
    prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, tenantId: true },
    }),
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { id: true, name: true, slug: true, themeId: true, logoLetter: true },
    }),
  ]);
  if (!branch || !tenant || branch.tenantId !== tenant.id) redirect("/dashboard");

  const openShift = await prisma.posShift.findFirst({
    where: { cashierId: user.id, closedAt: null },
    select: {
      id: true,
      branchId: true,
      openedAt: true,
      openingFloat: true,
      cashOutNotes: true,
    },
  });

  return (
    <ThemeProvider themeId={tenant.themeId} className="min-h-screen bg-qf-bg">
      <PosShell
        cashier={{ id: user.id, name: user.name, role: user.role }}
        tenant={{ id: tenant.id, slug: tenant.slug, name: tenant.name, logoLetter: tenant.logoLetter }}
        branch={{ id: branch.id, name: branch.name }}
        shift={
          openShift
            ? {
                id: openShift.id,
                openedAt: openShift.openedAt.toISOString(),
                openingFloat: openShift.openingFloat,
              }
            : null
        }
      >
        {children}
      </PosShell>
    </ThemeProvider>
  );
}
