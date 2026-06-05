"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IcoFlame, IcoChevDown } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";
import { NAV, type NavItem, type NavChild } from "./navConfig";
import { canAccessDashboard } from "@/lib/auth/merchant-access";

export function SidebarV2({
  tenant,
  role,
}: {
  tenant: { name: string; logoLetter: string; branchName: string };
  role?: string;
}) {
  const pathname = usePathname() || "";
  const sections = NAV.map((s) => ({
    ...s,
    items: s.items
      .map((it) => filterItemByRole(it, role))
      .filter((it): it is NavItem => it !== null),
  })).filter((s) => s.items.length > 0);

  return (
    <aside
      className="hidden lg:flex w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)] self-start overflow-y-auto p-4 flex-col gap-5 border-l-2 border-black"
      style={{ backgroundColor: "#FFF2C9" }}
    >
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
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-3 text-[10px] font-black uppercase tracking-wider text-black/40">
              {section.title}
            </div>
            {section.items.map((item) => (
              <NavRow key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>

      <div
        className="mt-auto flex items-start gap-2.5 rounded-2xl border-2 border-black px-3 py-3 text-xs shadow-[0_3px_0_#000] bg-white"
      >
        <IcoFlame c="#c2421f" s={16} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="font-black text-black">שעת שיא קרבה</div>
          <div className="text-black/70 leading-snug">
            היערכו לעומס בשעות 19–21
          </div>
        </div>
      </div>
    </aside>
  );
}

function filterItemByRole(item: NavItem, role: string | undefined): NavItem | null {
  if (!canAccessDashboard(role, item.href)) return null;
  if (!item.children) return item;
  const allowedChildren = item.children.filter((c) => canAccessDashboard(role, c.href));
  if (allowedChildren.length === 0) return item;
  return { ...item, children: allowedChildren };
}

function isItemActive(item: NavItem, pathname: string): boolean {
  const own = item.exact
    ? pathname === item.href
    : pathname.startsWith(item.match ?? item.href);
  if (own) return true;
  return (item.children ?? []).some((c) => isChildOwnActive(c, pathname));
}

function isChildOwnActive(child: NavChild, pathname: string): boolean {
  const prefix = child.match ?? child.href;
  return child.exact ? pathname === prefix : pathname.startsWith(prefix);
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

function NavRow({ item, pathname }: { item: NavItem; pathname: string }) {
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
          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition relative",
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
          "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition relative text-start",
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
        <div className="mt-1 ps-2 border-s-2 border-black/15 ms-5 space-y-1">
          {item.children!.map((child) => {
            const childActive = child.href === activeChild;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-2 ps-3 pe-3 py-2 rounded-lg text-sm transition",
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
