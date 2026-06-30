import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || session.role !== "platform_admin") {
    redirect("/dashboard/login");
  }

  const user = await prisma.merchantUser.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });

  return (
    <div className="min-h-screen bg-qf-bg-dash text-qf-ink">
      <header className="bg-white border-b border-qf-line-dash">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/admin/tenants" className="flex items-center gap-2 font-bold shrink-0">
            <div className="w-9 h-9 rounded-xl bg-qf-ink text-white grid place-items-center text-sm">
              QF
            </div>
            <div>
              <div>QuickFood Platform</div>
              <div className="text-[10px] text-qf-mute font-normal">ניהול לקוחות</div>
            </div>
          </Link>
          <div className="ms-auto text-xs text-qf-mute truncate max-w-[45%] sm:max-w-none">
            {user?.name} · <span dir="ltr">{user?.email}</span>
          </div>
          <nav className="order-3 w-full sm:order-none sm:w-auto sm:ms-4 flex gap-1 sm:gap-2 text-sm overflow-x-auto -mx-1 px-1">
            <Link
              href="/admin/tenants"
              className="px-3 py-1.5 rounded-lg hover:bg-qf-line-soft whitespace-nowrap"
            >
              לקוחות
            </Link>
            <Link
              href="/admin/analytics"
              className="px-3 py-1.5 rounded-lg hover:bg-qf-line-soft whitespace-nowrap"
            >
              אנליטיקס
            </Link>
            <Link
              href="/admin/leads"
              className="px-3 py-1.5 rounded-lg hover:bg-qf-line-soft whitespace-nowrap"
            >
              לידים מהאתר
            </Link>
            <Link
              href="/admin/grow-leads"
              className="px-3 py-1.5 rounded-lg hover:bg-qf-line-soft whitespace-nowrap"
            >
              לידים לסליקה
            </Link>
            <Link
              href="/admin/tenants/new"
              className="px-3 py-1.5 rounded-lg hover:bg-qf-line-soft whitespace-nowrap"
            >
              + לקוח חדש
            </Link>
            <Link
              href="/admin/quotes"
              className="px-3 py-1.5 rounded-lg hover:bg-qf-line-soft whitespace-nowrap"
            >
              הצעות מחיר
            </Link>
            <Link
              href="/admin/settings"
              className="px-3 py-1.5 rounded-lg hover:bg-qf-line-soft whitespace-nowrap"
            >
              הגדרות
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
