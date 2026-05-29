"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IcoHome, IcoMenuList, IcoBag, IcoUser, IcoStar } from "@/components/shared/Icons";
import { useCart } from "./CartProvider";
import { cn } from "@/lib/cn";

export function BottomTabBar({ tenantSlug }: { tenantSlug: string }) {
  const path = usePathname() || "";
  const { itemCount, tenant } = useCart();
  const showReviewsTab = !!tenant?.reviewsPublic;

  const homePath = `/s/${tenantSlug}`;
  // Menu lives inline on the home page — the "תפריט" tab is just a
  // scroll-anchor variant of the storefront route. On other pages
  // (cart, checkout, etc.) clicking it navigates back to home and the
  // browser scrolls to the anchor.
  const menuPath = `/s/${tenantSlug}#menu-section`;
  const onHome = path === homePath;

  // When viewing the home page, watch the inline `#menu-section` band.
  // While it's in the viewport we swap the active tab from "בית" to
  // "תפריט" — same affordance as if menu were a separate page.
  const [scrolledIntoMenu, setScrolledIntoMenu] = useState(false);
  useEffect(() => {
    if (!onHome) {
      setScrolledIntoMenu(false);
      return;
    }
    const el = document.getElementById("menu-section");
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setScrolledIntoMenu(entry.isIntersecting);
      },
      // Activates once the menu section's top edge crosses 35% from the
      // viewport top — matches the visual "I'm reading the menu now" moment.
      { rootMargin: "-35% 0px -50% 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHome, path]);

  type TabKey = "home" | "menu" | "cart" | "profile" | "reviews";

  const tabs: Array<{
    href: string;
    label: string;
    Icon: typeof IcoHome;
    key: TabKey;
    badge?: number;
  }> = [
    { href: homePath, label: "בית", Icon: IcoHome, key: "home" },
    { href: menuPath, label: "תפריט", Icon: IcoMenuList, key: "menu" },
    {
      href: `/s/${tenantSlug}/cart`,
      label: "הסל שלי",
      Icon: IcoBag,
      key: "cart",
      badge: itemCount > 0 ? itemCount : undefined,
    },
    ...(showReviewsTab
      ? [{ href: `/s/${tenantSlug}/reviews`, label: "ביקורות", Icon: IcoStar, key: "reviews" as TabKey }]
      : []),
    { href: `/s/${tenantSlug}/profile`, label: "אזור אישי", Icon: IcoUser, key: "profile" },
  ];

  function isActive(key: TabKey, href: string) {
    if (onHome) {
      if (key === "home") return !scrolledIntoMenu;
      if (key === "menu") return scrolledIntoMenu;
      return false;
    }
    if (key === "home") return path === href;
    return path.startsWith(href);
  }

  function handleClick(key: TabKey, e: React.MouseEvent) {
    if (!onHome) return;
    // On the home page the menu is inline — clicking "תפריט" should
    // scroll to it instead of navigating away. Same for "בית" → scroll
    // to top.
    if (key === "menu") {
      const el = document.getElementById("menu-section");
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else if (key === "home") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 max-w-md mx-auto bg-white/95 backdrop-blur border-t border-qf-line">
      <div
        className="grid px-2 py-2"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ href, label, Icon, badge, key }) => {
          const active = isActive(key, href);
          return (
            <Link
              key={key}
              href={href}
              onClick={(e) => handleClick(key, e)}
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
