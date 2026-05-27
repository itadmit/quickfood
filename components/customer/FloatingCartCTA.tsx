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
    <div className="fixed inset-x-0 bottom-16 z-40 px-4 pointer-events-none lg:hidden">
      <Link
        href={`/s/${tenant.slug}/cart`}
        className="pointer-events-auto max-w-md mx-auto flex items-center justify-between gap-3 bg-black text-white rounded-2xl border-2 border-black shadow-[0_4px_0_#000] px-4 py-3 hover:brightness-110 active:translate-y-px transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="bg-(--qf-yolk) text-black rounded-full w-7 h-7 grid place-items-center text-sm font-black tnum shrink-0">
            {itemCount}
          </span>
          <span className="font-bold text-sm">הצגת פריטים</span>
        </div>
        <span className="font-bold tnum text-sm">{formatPrice(subtotal)}</span>
      </Link>
    </div>
  );
}
