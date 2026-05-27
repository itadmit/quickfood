"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IcoClose } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";
import { NAV } from "./navConfig";

interface Props {
  tenant: { name: string; logoLetter: string; branchName: string };
}

/**
 * Mobile hamburger + slide-in drawer for the V2 dashboard. SidebarV2
 * is `hidden lg:flex`, so under 1024px the merchant has no way to
 * navigate. This component provides the hamburger button (anchored
 * to the topbar area) and the drawer that mirrors the sidebar's nav.
 *
 * Auto-closes on route change so tapping a nav item navigates and
 * dismisses the drawer in the same motion.
 */
export function MobileMenuV2({ tenant }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "";

  // Close on route change — without this the drawer stays open while
  // the new page loads behind it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open so the page underneath doesn't peek-
  // scroll when the merchant scrolls a long nav.
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="פתח תפריט ניווט"
        // Rendered inline inside <TopbarV2>'s flex row. `lg:hidden`
        // hides on desktop where the sidebar takes over.
        className="lg:hidden inline-flex w-10 h-10 rounded-xl bg-black text-[#F8CB1E] border-2 border-black shadow-[0_2px_0_#000] place-items-center justify-center active:translate-y-px active:shadow-[0_1px_0_#000] transition shrink-0"
      >
        <span aria-hidden className="block space-y-[3px]">
          <span className="block w-4 h-[2px] bg-[#F8CB1E] rounded" />
          <span className="block w-4 h-[2px] bg-[#F8CB1E] rounded" />
          <span className="block w-4 h-[2px] bg-[#F8CB1E] rounded" />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="lg:hidden fixed inset-0 z-50"
        >
          {/* Backdrop — click to close */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

          {/* Drawer — slides from inline-start (RTL = right) */}
          <aside
            className="absolute inset-s-0 top-0 bottom-0 w-[82%] max-w-[320px] flex flex-col gap-5 p-4 border-s-2 border-black overflow-y-auto"
            style={{ backgroundColor: "#FFF2C9" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-3 flex-1 min-w-0 p-1 rounded-2xl"
              >
                <div className="w-11 h-11 rounded-xl bg-black grid place-items-center text-[#F8CB1E] text-lg font-black shrink-0 border-2 border-black shadow-[0_3px_0_#000]">
                  {tenant.logoLetter}
                </div>
                <div className="min-w-0">
                  <div className="font-black truncate text-sm">{tenant.name}</div>
                  <div className="text-[11px] text-black/60 truncate">{tenant.branchName}</div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגור תפריט"
                className="w-9 h-9 rounded-full grid place-items-center bg-white border-2 border-black shadow-[0_2px_0_#000] shrink-0"
              >
                <IcoClose s={14} c="#000" />
              </button>
            </div>

            <nav className="space-y-4">
              {NAV.map((section) => (
                <div key={section.title} className="space-y-1">
                  <div className="px-3 text-[10px] font-black uppercase tracking-wider text-black/40">
                    {section.title}
                  </div>
                  {section.items.map(({ href, label, Icon, exact, match, badge }) => {
                    const active = exact
                      ? pathname === href
                      : pathname.startsWith(match ?? href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition",
                          active
                            ? "bg-[#F8CB1E] text-black font-black border-2 border-black shadow-[0_3px_0_#000]"
                            : "text-black/85 hover:bg-black/4 font-medium",
                        )}
                      >
                        <Icon c="#000" s={19} />
                        <span>{label}</span>
                        {badge && (
                          <span className="text-[10px] font-black bg-white text-black border border-black rounded-md px-1.5 py-0.5 leading-none">
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
