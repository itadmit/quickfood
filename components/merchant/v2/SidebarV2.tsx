"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IcoFlame } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";
import { NAV } from "./navConfig";
import { canAccessDashboard } from "@/lib/auth/merchant-access";

export function SidebarV2({
  tenant,
  role,
}: {
  tenant: { name: string; logoLetter: string; branchName: string };
  role?: string;
}) {
  const pathname = usePathname() || "";
  // Hide sections/items the current role can't open (kitchen sees only
  // orders + kitchen, etc.). Empty sections drop out entirely.
  const sections = NAV.map((s) => ({
    ...s,
    items: s.items.filter((it) => canAccessDashboard(role, it.href)),
  })).filter((s) => s.items.length > 0);

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
        {sections.map((section) => (
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
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition relative",
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

      {/* "Peak hour coming" callout — pinned to the bottom of the
          sidebar via the parent's flex-col + `mt-auto`. V2 brand
          language: warm yellow tile with 2px black border + hard
          shadow, flame icon in tomato red. */}
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
