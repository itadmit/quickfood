"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  IcoClose,
  IcoBag,
} from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

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
  { href: "/dashboard/menu", label: "תפריט", Icon: IcoMenu },
  { href: "/dashboard/campaigns", label: "קמפיינים", Icon: IcoMegaphone },
  { href: "/dashboard/reviews", label: "ביקורות", Icon: IcoStar },
  { href: "/dashboard/sms", label: "SMS", Icon: IcoBell },
  { href: "/dashboard/billing", label: "חיוב ומנוי", Icon: IcoCreditCard },
  { href: "/dashboard/couriers", label: "שליחים", Icon: IcoBike },
  {
    href: "/dashboard/settings/branding",
    label: "הגדרות",
    Icon: IcoGear,
    match: "/dashboard/settings",
  },
];

interface Props {
  tenant: { name: string; logoLetter: string; branchName: string };
}

/**
 * Mobile-only nav drawer. Renders a hamburger button on the start of the
 * Topbar (lg:hidden) and an overlay drawer that slides in from the start
 * edge with the same NAV items as the desktop Sidebar.
 */
export function MobileNav({ tenant }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "";

  // Close on route change so the drawer doesn't linger over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="פתח תפריט"
        className="lg:hidden w-10 h-10 rounded-xl border border-qf-line-dash grid place-items-center hover:bg-qf-line-soft"
      >
        <IcoMenu s={20} />
      </button>

      {/* Backdrop + drawer. RTL: drawer enters from the inline-start edge,
          which is the right side in Hebrew. We use logical insets so this
          mirrors automatically. */}
      <div
        aria-hidden={!open}
        className={cn(
          "lg:hidden fixed inset-0 z-50 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="סגור תפריט"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          tabIndex={-1}
        />
        <aside
          className={cn(
            "absolute inset-y-0 inset-s-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-200",
            open ? "translate-x-0" : "rtl:translate-x-full ltr:-translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label="ניווט"
        >
          <header className="flex items-center justify-between px-4 py-4 border-b border-qf-line-soft">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-(--qf-primary) text-white grid place-items-center font-bold">
                {tenant.logoLetter}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{tenant.name}</div>
                {tenant.branchName && (
                  <div className="text-xs text-qf-mute truncate">{tenant.branchName}</div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגור"
              className="w-9 h-9 rounded-lg hover:bg-qf-line-soft grid place-items-center"
            >
              <IcoClose s={16} />
            </button>
          </header>

          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {NAV.map(({ href, label, Icon, match, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(match ?? href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition",
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
        </aside>
      </div>
    </>
  );
}
