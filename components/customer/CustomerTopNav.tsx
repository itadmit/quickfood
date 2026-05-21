"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IcoPin, IcoCart, IcoUser } from "@/components/shared/Icons";
import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/format";
import { SmartImg } from "@/components/shared/SmartImg";
import { cn } from "@/lib/cn";

interface Props {
  tenantSlug: string;
  tenantName: string;
  logoLetter: string;
  logoUrl: string | null;
  branchAddress: string | null;
}

/**
 * Desktop-only top navigation. Mobile keeps the BottomTabBar.
 *
 * Wolt-style: thin sticky bar with logo+name on the start, location pill in
 * the middle, profile and cart actions at the end. Hidden below lg breakpoint
 * so the mobile experience is untouched.
 */
export function CustomerTopNav({ tenantSlug, tenantName, logoLetter, logoUrl, branchAddress }: Props) {
  const path = usePathname() || "";
  const { itemCount, subtotal } = useCart();

  // Don't show "go to cart" CTA when we're already there or on checkout.
  const onCartLike = path === `/${tenantSlug}/cart` || path === `/${tenantSlug}/checkout`;

  return (
    <header className="hidden lg:flex sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-qf-line">
      <div className="w-full max-w-7xl mx-auto px-6 h-16 flex items-center gap-5">
        <Link
          href={`/${tenantSlug}`}
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

        {branchAddress && (
          <div className="flex items-center gap-1.5 bg-qf-line-soft px-3 py-1.5 rounded-full text-sm text-qf-ink2 min-w-0">
            <IcoPin c="#3a4a40" s={14} />
            <span className="truncate max-w-60">{branchAddress}</span>
          </div>
        )}

        <div className="flex-1" />

        <Link
          href={`/${tenantSlug}/profile`}
          aria-label="אזור אישי"
          className="w-10 h-10 rounded-full bg-qf-line-soft hover:bg-qf-line grid place-items-center transition"
        >
          <IcoUser c="#11231a" s={18} />
        </Link>

        {!onCartLike && itemCount > 0 && (
          <Link
            href={`/${tenantSlug}/cart`}
            className={cn(
              "bg-(--qf-primary) hover:bg-(--qf-deep) text-white rounded-full px-4 h-10",
              "inline-flex items-center gap-2 text-sm font-semibold shadow-sm transition",
            )}
          >
            <span className="bg-white/22 rounded-full w-6 h-6 grid place-items-center text-xs font-bold tnum">
              {itemCount}
            </span>
            <span>סל</span>
            <span className="tnum">{formatPrice(subtotal)}</span>
          </Link>
        )}
      </div>
    </header>
  );
}
