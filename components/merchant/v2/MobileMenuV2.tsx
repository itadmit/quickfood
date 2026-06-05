"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IcoClose, IcoChevDown } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";
import { NAV, type NavItem, type NavChild } from "./navConfig";
import { canAccessDashboard } from "@/lib/auth/merchant-access";

interface Props {
  tenant: { name: string; logoLetter: string; branchName: string };
  role?: string;
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
export function MobileMenuV2({ tenant, role }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname() || "";

  useEffect(() => {
    setMounted(true);
  }, []);
  const sections = NAV.map((s) => ({
    ...s,
    items: s.items
      .map((it) => filterItemByRole(it, role))
      .filter((it): it is NavItem => it !== null),
  })).filter((s) => s.items.length > 0);

  // Close on route change - without this the drawer stays open while
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

      {open && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="lg:hidden fixed inset-0 z-50"
        >
          {/* Backdrop - click to close */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />

          {/* Drawer - slides from inline-start (RTL = right) */}
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
              {sections.map((section) => (
                <div key={section.title} className="space-y-1">
                  <div className="px-3 text-[10px] font-black uppercase tracking-wider text-black/40">
                    {section.title}
                  </div>
                  {section.items.map((item) => (
                    <MobileNavRow key={item.href} item={item} pathname={pathname} />
                  ))}
                </div>
              ))}
            </nav>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}

function filterItemByRole(item: NavItem, role: string | undefined): NavItem | null {
  if (!canAccessDashboard(role, item.href)) return null;
  if (!item.children) return item;
  const allowedChildren = item.children.filter((c) => canAccessDashboard(role, c.href));
  if (allowedChildren.length === 0) return item;
  return { ...item, children: allowedChildren };
}

function isChildOwnActive(child: NavChild, pathname: string): boolean {
  const prefix = child.match ?? child.href;
  return child.exact ? pathname === prefix : pathname.startsWith(prefix);
}

function isItemActive(item: NavItem, pathname: string): boolean {
  const own = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.match ?? item.href);
  if (own) return true;
  return (item.children ?? []).some((c) => isChildOwnActive(c, pathname));
}

function activeChildHref(children: NavChild[], pathname: string): string | null {
  let bestHref: string | null = null;
  let bestLen = -1;
  for (const c of children) {
    if (!isChildOwnActive(c, pathname)) continue;
    const len = (c.match ?? c.href).length;
    if (len > bestLen) {
      bestHref = c.href;
      bestLen = len;
    }
  }
  return bestHref;
}

function MobileNavRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const hasChildren = !!item.children?.length;
  const active = isItemActive(item, pathname);
  const activeChild = hasChildren ? activeChildHref(item.children!, pathname) : null;
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition",
          active
            ? "bg-[#F8CB1E] text-black font-black border-2 border-black shadow-[0_3px_0_#000]"
            : "text-black/85 hover:bg-black/4 font-medium",
        )}
      >
        <item.Icon c="#000" s={19} />
        <span>{item.label}</span>
        {item.badge && (
          <span className="text-[10px] font-black bg-white text-black border border-black rounded-md px-1.5 py-0.5 leading-none">
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition text-start",
          active
            ? "bg-[#F8CB1E] text-black font-black border-2 border-black shadow-[0_3px_0_#000]"
            : "text-black/85 hover:bg-black/4 font-medium",
        )}
      >
        <item.Icon c="#000" s={19} />
        <span className="flex-1">{item.label}</span>
        <IcoChevDown
          c="#000"
          s={14}
          className={cn("transition-transform", open ? "rotate-180" : "")}
        />
      </button>
      {open && (
        <div className="mt-0.5 ps-2 border-s-2 border-black/15 ms-5">
          {item.children!.map((child) => {
            const childActive = child.href === activeChild;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2 ps-3 pe-3 h-7 rounded-lg text-sm leading-none transition",
                  childActive
                    ? "bg-black text-[#F8CB1E] font-bold"
                    : "text-black/80 hover:bg-black/5 font-medium",
                )}
              >
                <span>{child.label}</span>
                {child.badge && (
                  <span className="text-[10px] font-black bg-white text-black border border-black rounded-md px-1.5 py-0.5 leading-none">
                    {child.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
