import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { Sidebar } from "@/components/merchant/Sidebar";
import { Topbar } from "@/components/merchant/Topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
      <div className="min-h-screen bg-qf-bg-dash text-qf-ink flex flex-col">
        <Topbar user={user} />
        <div className="flex-1 flex">
          <main className="flex-1 min-w-0 p-6">{children}</main>
          <Sidebar tenant={{ name: tenant.name, logoLetter: tenant.logoLetter, branchName: tenant.branches[0]?.name ?? "" }} />
        </div>
      </div>
    </ThemeProvider>
  );
}
