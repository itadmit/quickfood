"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IcoOrders,
  IcoMenu,
  IcoHome,
  IcoStar,
  IcoBike,
  IcoGear,
  IcoMegaphone,
  IcoBell,
  IcoCreditCard,
} from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

// Mirrors the production NAV but rebased onto /dashboard-v2 for the
// sandbox routes that exist (home only). Items we haven't ported yet
// fall back to the live /dashboard route so the sidebar is fully
// navigable even from the experiment.
type NavItem = {
  href: string;
  label: string;
  Icon: typeof IcoHome;
  exact?: boolean;
  match?: string;
  external?: boolean; // true = jumps to the live /dashboard equivalent
};

const NAV: NavItem[] = [
  { href: "/dashboard-v2", label: "דשבורד", Icon: IcoHome, exact: true },
  { href: "/dashboard/orders", label: "הזמנות", Icon: IcoOrders, external: true },
  { href: "/dashboard/menu", label: "תפריט", Icon: IcoMenu, external: true },
  { href: "/dashboard/campaigns", label: "קמפיינים", Icon: IcoMegaphone, external: true },
  { href: "/dashboard/coupons", label: "קופונים", Icon: IcoCreditCard, external: true },
  { href: "/dashboard/reviews", label: "ביקורות", Icon: IcoStar, external: true },
  { href: "/dashboard/sms", label: "SMS", Icon: IcoBell, external: true },
  { href: "/dashboard/billing", label: "חיוב ומנוי", Icon: IcoCreditCard, external: true },
  { href: "/dashboard/couriers", label: "שליחים", Icon: IcoBike, external: true },
  {
    href: "/dashboard/settings/branding",
    label: "הגדרות",
    Icon: IcoGear,
    match: "/dashboard/settings",
    external: true,
  },
];

export function SidebarV2({
  tenant,
}: {
  tenant: { name: string; logoLetter: string; branchName: string };
}) {
  const pathname = usePathname() || "";

  return (
    <aside
      className="hidden lg:flex w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)] self-start overflow-y-auto p-4 flex-col gap-5"
      style={{ backgroundColor: "#FFFBEC" }}
    >
      {/* Brand mark — black tile with yellow letter */}
      <Link
        href="/dashboard-v2"
        className="flex items-center gap-3 p-2 rounded-2xl hover:bg-black/5 transition"
      >
        <div className="w-11 h-11 rounded-xl bg-black grid place-items-center text-[#F8CB1E] text-lg font-black shrink-0 border-2 border-black shadow-[0_3px_0_#000]">
          {tenant.logoLetter}
        </div>
        <div className="min-w-0">
          <div className="font-black truncate text-sm">{tenant.name}</div>
          <div className="text-[11px] text-black/60 truncate">{tenant.branchName}</div>
        </div>
      </Link>

      <nav className="space-y-1.5">
        {NAV.map(({ href, label, Icon, exact, match, external }) => {
          const active = exact
            ? pathname === href
            : pathname.startsWith(match ?? href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition border-2 relative",
                active
                  ? "bg-[#F8CB1E] text-black border-black shadow-[0_3px_0_#000]"
                  : "bg-transparent text-black/80 border-transparent hover:bg-black/5 hover:border-black/10",
              )}
            >
              <Icon
                c={active ? "#000" : "rgba(0,0,0,0.7)"}
                s={20}
              />
              <span>{label}</span>
              {external && !active && (
                <span
                  className="ms-auto text-[9px] font-black tracking-wide text-black/40 bg-black/5 px-1.5 py-0.5 rounded"
                  aria-label="עובר לדשבורד הקיים"
                >
                  v1
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl bg-black text-white px-3.5 py-3 border-2 border-black shadow-[0_3px_0_#000]">
        <div className="text-[10px] font-black tracking-wide text-[#F8CB1E] mb-0.5">
          ניסוי עיצוב
        </div>
        <div className="text-xs leading-snug text-white/90">
          זו תצוגה בהתהוות (v2). הנתונים אמיתיים, חלק מהקישורים מובילים
          לדשבורד הקיים.
        </div>
      </div>
    </aside>
  );
}
