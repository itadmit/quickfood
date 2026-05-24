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

// Nav for the V2 dashboard skin. Same route set as the V1 Sidebar — the
// shell choice (V1 vs V2) is layout-level, so all hrefs point at the
// canonical /dashboard/* routes.
type NavItem = {
  href: string;
  label: string;
  Icon: typeof IcoHome;
  exact?: boolean;
  match?: string;
};

// Nav is grouped so the sidebar reads as "what I do daily" first, then
// "what I configure occasionally" — gives the long list a visual break
// instead of a 10-item undifferentiated stack.
type NavSection = { title: string; items: NavItem[] };

const NAV: NavSection[] = [
  {
    title: "תפעול",
    items: [
      { href: "/dashboard", label: "דשבורד", Icon: IcoHome, exact: true },
      { href: "/dashboard/orders", label: "הזמנות", Icon: IcoOrders },
      { href: "/dashboard/menu", label: "תפריט", Icon: IcoMenu },
      { href: "/dashboard/couriers", label: "שליחים", Icon: IcoBike },
    ],
  },
  {
    title: "שיווק",
    items: [
      { href: "/dashboard/campaigns", label: "קמפיינים", Icon: IcoMegaphone },
      { href: "/dashboard/coupons", label: "קופונים", Icon: IcoCreditCard },
      { href: "/dashboard/reviews", label: "ביקורות", Icon: IcoStar },
      { href: "/dashboard/sms", label: "SMS", Icon: IcoBell },
    ],
  },
  {
    title: "מערכת",
    items: [
      { href: "/dashboard/billing", label: "חיוב ומנוי", Icon: IcoCreditCard },
      {
        href: "/dashboard/settings/branding",
        label: "הגדרות",
        Icon: IcoGear,
        match: "/dashboard/settings",
      },
    ],
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
      className="hidden lg:flex w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)] self-start overflow-y-auto p-4 flex-col gap-5 border-l-2 border-black"
      style={{ backgroundColor: "#FFF2C9" }}
    >
      {/* Brand mark — black tile with yellow letter */}
      <Link
        href="/dashboard"
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

      <nav className="space-y-4">
        {NAV.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 text-[10px] font-black uppercase tracking-wider text-black/40">
              {section.title}
            </div>
            {section.items.map(({ href, label, Icon, exact, match }) => {
              const active = exact
                ? pathname === href
                : pathname.startsWith(match ?? href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition relative",
                    active
                      ? "bg-[#F8CB1E] text-black font-bold border-2 border-black shadow-[0_3px_0_#000]"
                      : "text-black/85 hover:bg-black/4 font-medium",
                  )}
                >
                  <Icon c="#000" s={19} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

    </aside>
  );
}
