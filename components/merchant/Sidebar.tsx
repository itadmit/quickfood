"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IcoOrders, IcoMenu, IcoMenuList, IcoHome, IcoStar, IcoBike, IcoGear, IcoFlame, IcoMegaphone, IcoBell, IcoCreditCard, IcoChart, IcoBag } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";
import { canAccessDashboard } from "@/lib/auth/merchant-access";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof IcoHome;
  match?: string;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "דשבורד", Icon: IcoHome, exact: true },
  { href: "/dashboard/orders", label: "הזמנות", Icon: IcoOrders },
  { href: "/pos", label: "קופה", Icon: IcoBag },
  { href: "/dashboard/menu", label: "מוצרים", Icon: IcoMenu, exact: true },
  { href: "/dashboard/categories", label: "קטגוריות", Icon: IcoMenuList },
  { href: "/dashboard/menu/modifiers", label: "קטלוג תוספות", Icon: IcoMenuList },
  { href: "/dashboard/menu/deals", label: "דילים", Icon: IcoMenuList },
  { href: "/dashboard/menu/notices", label: "הודעות", Icon: IcoMenuList },
  { href: "/dashboard/analytics", label: "אנליטיקס", Icon: IcoChart },
  { href: "/dashboard/campaigns", label: "קמפיינים", Icon: IcoMegaphone },
  { href: "/dashboard/coupons", label: "קופונים", Icon: IcoCreditCard },
  { href: "/dashboard/reviews", label: "ביקורות", Icon: IcoStar },
  { href: "/dashboard/messaging", label: "דיוור והתראות", Icon: IcoBell },
  { href: "/dashboard/billing", label: "חיוב ומנוי", Icon: IcoCreditCard },
  { href: "/dashboard/couriers", label: "שליחים", Icon: IcoBike },
  { href: "/dashboard/settings/branding", label: "הגדרות", Icon: IcoGear, match: "/dashboard/settings" },
];

export function Sidebar({ tenant, role }: { tenant: { name: string; logoLetter: string; branchName: string }; role?: string }) {
  const pathname = usePathname() || "";
  const items = NAV.filter((it) => canAccessDashboard(role, it.href));
  return (
    <aside className="hidden lg:flex w-64 shrink-0 border-e border-qf-line-dash bg-white p-5 flex-col gap-6 sticky top-16 h-[calc(100vh-4rem)] self-start overflow-y-auto">
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-2xl bg-(--qf-primary) text-white flex items-center justify-center text-lg font-bold"
          aria-hidden
        >
          {tenant.logoLetter}
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{tenant.name}</div>
          <div className="text-xs text-qf-mute truncate">{tenant.branchName}</div>
        </div>
      </div>

      <nav className="-mx-1 space-y-0.5">
        {items.map(({ href, label, Icon, match, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(match ?? href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition",
                active
                  ? "bg-qf-green-soft text-(--qf-deep) font-medium"
                  : "text-qf-ink2 hover:bg-qf-line-soft",
              )}
            >
              <Icon c={active ? "var(--qf-primary)" : "#3a4a40"} s={20} />
              <span className="text-sm">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl bg-qf-warm-dash/70 border border-qf-warm-dash px-3 py-3 flex items-start gap-2 text-xs">
        <IcoFlame c="#c2421f" s={16} className="mt-0.5" />
        <div>
          <div className="font-medium text-qf-ink">שעת שיא קרבה</div>
          <div className="text-qf-ink2/80">היערכו לעומס בשעות 19-21</div>
        </div>
      </div>
    </aside>
  );
}
