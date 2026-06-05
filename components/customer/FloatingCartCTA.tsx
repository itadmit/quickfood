"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";

const HIDDEN_PATH_SUFFIXES = ["/cart", "/checkout"];
// /orders/<uuid> - the post-order confirmation/tracking page. Showing the
// cart there confuses the customer (they just paid, why is there a CTA to
// pay again?). Matches any /orders/<anything> under a tenant slug.
const HIDDEN_PATH_PATTERNS: RegExp[] = [/\/orders\/[^/]+$/];
const DISMISS_KEY = "qf:cart-cta-dismissed-at";

export function FloatingCartCTA() {
  const { lines, subtotal, itemCount, tenant, hydrated } = useCart();
  const pathname = usePathname() || "";
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  // Persist dismissal across navigations within the session. We store
  // the line count at the time of dismissal - if the customer adds
  // something new (line count grows), the toast re-appears.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DISMISS_KEY);
      if (raw !== null) setDismissedAt(parseInt(raw, 10) || 0);
    } catch {
      /* ignore */
    }
  }, []);

  function dismiss() {
    setDismissedAt(lines.length);
    try {
      sessionStorage.setItem(DISMISS_KEY, String(lines.length));
    } catch {
      /* ignore */
    }
  }

  if (!hydrated) return null;
  if (lines.length === 0) return null;
  if (HIDDEN_PATH_SUFFIXES.some((p) => pathname.endsWith(p))) return null;
  if (HIDDEN_PATH_PATTERNS.some((re) => re.test(pathname))) return null;
  if (dismissedAt !== null && lines.length <= dismissedAt) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 px-4 pointer-events-none lg:bottom-6">
      <div
        className="pointer-events-auto max-w-md mx-auto flex items-stretch rounded-2xl shadow-xl shadow-black/15 overflow-hidden animate-qf-toast-in"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--qf-primary) 98%, transparent)",
        }}
      >
        <Link
          href={`/s/${tenant.slug}/cart`}
          className="flex-1 flex items-center justify-between gap-3 text-white px-4 py-3.5 hover:bg-(--qf-deep) active:translate-y-px transition"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              key={itemCount}
              className="bg-white text-(--qf-deep) rounded-full min-w-7 h-7 px-2 grid place-items-center text-sm font-black tnum shrink-0 animate-qf-bump"
            >
              {itemCount}
            </span>
            <span className="font-bold text-sm">הצגת פריטים</span>
          </div>
          <span className="font-bold tnum text-sm">{formatPrice(subtotal)}</span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          aria-label="הסתר עגלה"
          title="הסתר"
          className="px-3 text-white/80 hover:text-white hover:bg-black/15 border-s border-white/15 grid place-items-center transition"
        >
          <ChevDownIcon />
        </button>
      </div>
    </div>
  );
}

function ChevDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
