"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";

const HIDDEN_PATH_SUFFIXES = ["/cart", "/checkout"];

export function FloatingCartCTA() {
  const { lines, subtotal, itemCount, tenant, hydrated } = useCart();
  const pathname = usePathname() || "";

  if (!hydrated) return null;
  if (lines.length === 0) return null;
  if (HIDDEN_PATH_SUFFIXES.some((p) => pathname.endsWith(p))) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 px-4 pointer-events-none lg:hidden">
      <Link
        href={`/s/${tenant.slug}/cart`}
        className="pointer-events-auto max-w-md mx-auto flex items-center justify-between gap-3 bg-(--qf-primary) hover:bg-(--qf-deep) text-white rounded-2xl shadow-lg shadow-black/10 px-4 py-3.5 active:translate-y-px transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="bg-white/25 backdrop-blur text-white rounded-full min-w-7 h-7 px-2 grid place-items-center text-sm font-black tnum shrink-0">
            {itemCount}
          </span>
          <span className="font-bold text-sm">הצגת פריטים</span>
        </div>
        <span className="font-bold tnum text-sm">{formatPrice(subtotal)}</span>
      </Link>
    </div>
  );
}
