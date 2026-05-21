"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IcoHome, IcoMenuList, IcoBag, IcoUser } from "@/components/shared/Icons";
import { useCart } from "./CartProvider";
import { cn } from "@/lib/cn";

export function BottomTabBar({ tenantSlug }: { tenantSlug: string }) {
  const path = usePathname() || "";
  const { itemCount } = useCart();

  const tabs = [
    { href: `/${tenantSlug}`, label: "בית", Icon: IcoHome, exact: true },
    { href: `/${tenantSlug}/menu`, label: "תפריט", Icon: IcoMenuList },
    { href: `/${tenantSlug}/cart`, label: "הסל שלי", Icon: IcoBag, badge: itemCount > 0 ? itemCount : undefined },
    { href: `/${tenantSlug}/profile`, label: "אזור אישי", Icon: IcoUser },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 max-w-md mx-auto bg-white/95 backdrop-blur border-t border-qf-line">
      <div className="grid grid-cols-4 px-2 py-2">
        {tabs.map(({ href, label, Icon, badge, exact }) => {
          const active = exact ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-1 rounded-xl text-[11px]",
                active ? "text-(--qf-deep) font-medium" : "text-qf-mute",
              )}
            >
              <div className="relative">
                <Icon
                  c={active ? "var(--qf-primary)" : "#7c8a82"}
                  s={22}
                  className="block"
                />
                {badge !== undefined && (
                  <span className="absolute -top-1 -end-1 bg-qf-tomato text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 grid place-items-center tnum">
                    {badge}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
