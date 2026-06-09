"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IcoUser, IcoMenuList, IcoHome, IcoBag, IcoSearch, IcoStar } from "@/components/shared/Icons";
import { useCart } from "./CartProvider";
import { useMenuSearch } from "./MenuSearchProvider";
import { formatPrice } from "@/lib/format";
import { SmartImg } from "@/components/shared/SmartImg";
import { cn } from "@/lib/cn";

interface Props {
  tenantSlug: string;
  tenantName: string;
  logoLetter: string;
  logoUrl: string | null;
}

/**
 * Desktop-only top navigation. Mobile keeps the BottomTabBar.
 *
 * Wolt-style: thin sticky bar with logo+name on the start, location pill in
 * the middle, profile and cart actions at the end. Hidden below lg breakpoint
 * so the mobile experience is untouched.
 */
export function CustomerTopNav({ tenantSlug, tenantName, logoLetter, logoUrl }: Props) {
  const path = usePathname() || "";
  const { itemCount, subtotal, tenant } = useCart();
  const { query, setQuery } = useMenuSearch();

  const homePath = `/s/${tenantSlug}`;
  const onHome = path === homePath;
  const onCartLike = path === `/s/${tenantSlug}/cart` || path === `/s/${tenantSlug}/checkout`;
  const onProfile = path.startsWith(`/s/${tenantSlug}/profile`);
  const onReviews = path.startsWith(`/s/${tenantSlug}/reviews`);
  const showReviewsLink = !!tenant?.reviewsPublic;

  const onOrderPage = /^\/[^/]+\/orders\/[^/]+/.test(path);

  const [menuActive, setMenuActive] = useState(false);
  useEffect(() => {
    if (!onHome) { setMenuActive(false); return; }
    function check() {
      const el = document.getElementById("menu-section");
      if (!el) return;
      setMenuActive(el.getBoundingClientRect().top <= 80);
    }
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, [onHome]);

  if (onOrderPage) return null;

  function handleMenuClick(e: React.MouseEvent) {
    if (!onHome) return;
    const el = document.getElementById("menu-section");
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleHomeClick(e: React.MouseEvent) {
    if (!onHome) return;
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <header className="hidden lg:flex sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-qf-line">
      <div className="w-full max-w-7xl mx-auto px-6 h-16 flex items-center gap-5">
        <Link
          href={`/s/${tenantSlug}`}
          className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition"
        >
          {logoUrl ? (
            <span className="w-9 h-9 rounded-full overflow-hidden bg-white border border-qf-line grid place-items-center">
              <SmartImg
                src={logoUrl}
                alt=""
                width={36}
                height={36}
                className="object-contain w-full h-full"
              />
            </span>
          ) : (
            <span className="w-9 h-9 rounded-full bg-(--qf-primary) text-white grid place-items-center font-bold text-base">
              {logoLetter}
            </span>
          )}
          <span className="font-semibold truncate">{tenantName}</span>
        </Link>

        {onHome ? (
          <div className="flex-1 max-w-xl bg-white border border-qf-line rounded-full flex items-center gap-2.5 px-4 h-10 focus-within:ring-2 focus-within:ring-(--qf-primary) focus-within:border-transparent transition">
            <IcoSearch c="#7c8a82" s={16} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש בתפריט"
              aria-label="חיפוש בתפריט"
              className="flex-1 bg-transparent outline-none border-0 appearance-none text-sm text-qf-ink placeholder:text-qf-mute [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs text-qf-mute hover:text-qf-ink shrink-0"
                aria-label="נקה חיפוש"
              >
                נקה
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <nav className="flex items-center gap-1">
          <Link
            href={homePath}
            onClick={handleHomeClick}
            className={cn(
              "inline-flex items-center gap-2 px-3 h-10 rounded-full text-sm font-medium transition",
              onHome && !menuActive
                ? "bg-(--qf-soft) text-(--qf-deep)"
                : "text-qf-ink2 hover:bg-qf-line-soft",
            )}
          >
            <IcoHome c={onHome && !menuActive ? "var(--qf-primary)" : "#3a4a40"} s={16} />
            <span>בית</span>
          </Link>
          <Link
            href={`${homePath}#menu-section`}
            onClick={handleMenuClick}
            className={cn(
              "inline-flex items-center gap-2 px-3 h-10 rounded-full text-sm font-medium transition",
              menuActive
                ? "bg-(--qf-soft) text-(--qf-deep)"
                : "text-qf-ink2 hover:bg-qf-line-soft",
            )}
          >
            <IcoMenuList c={menuActive ? "var(--qf-primary)" : "#3a4a40"} s={16} />
            <span>תפריט</span>
          </Link>
          {showReviewsLink && (
            <Link
              href={`/s/${tenantSlug}/reviews`}
              className={cn(
                "inline-flex items-center gap-2 px-3 h-10 rounded-full text-sm font-medium transition",
                onReviews
                  ? "bg-(--qf-soft) text-(--qf-deep)"
                  : "text-qf-ink2 hover:bg-qf-line-soft",
              )}
            >
              <IcoStar
                c={onReviews ? "var(--qf-primary)" : "#3a4a40"}
                fill={onReviews ? "var(--qf-primary)" : "none"}
                s={16}
              />
              <span>ביקורות</span>
            </Link>
          )}
          <Link
            href={`/s/${tenantSlug}/cart`}
            className={cn(
              "relative inline-flex items-center gap-2 px-3 h-10 rounded-full text-sm font-medium transition",
              onCartLike
                ? "bg-(--qf-soft) text-(--qf-deep)"
                : "text-qf-ink2 hover:bg-qf-line-soft",
            )}
          >
            <span className="relative">
              <IcoBag c={onCartLike ? "var(--qf-primary)" : "#3a4a40"} s={16} />
              {!onCartLike && itemCount > 0 && (
                <span className="absolute -top-1.5 -inset-e-1.5 bg-qf-tomato text-white text-[9px] font-bold rounded-full min-w-4 h-4 px-1 grid place-items-center tnum">
                  {itemCount}
                </span>
              )}
            </span>
            <span>הסל שלי</span>
          </Link>
          <Link
            href={`/s/${tenantSlug}/profile`}
            aria-label="אזור אישי"
            className={cn(
              "inline-flex items-center gap-2 px-3 h-10 rounded-full text-sm font-medium transition",
              onProfile
                ? "bg-(--qf-soft) text-(--qf-deep)"
                : "text-qf-ink2 hover:bg-qf-line-soft",
            )}
          >
            <IcoUser c={onProfile ? "var(--qf-primary)" : "#3a4a40"} s={16} />
            <span>אזור אישי</span>
          </Link>
        </nav>

        {!onCartLike && itemCount > 0 && (
          <Link
            href={`/s/${tenantSlug}/cart`}
            className={cn(
              "bg-(--qf-primary) hover:bg-(--qf-deep) text-white rounded-full px-4 h-10 ms-2",
              "inline-flex items-center gap-2 text-sm font-semibold shadow-sm transition",
            )}
          >
            <span className="bg-white/22 rounded-full w-6 h-6 grid place-items-center text-xs font-bold tnum">
              {itemCount}
            </span>
            <span className="tnum">{formatPrice(subtotal)}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
