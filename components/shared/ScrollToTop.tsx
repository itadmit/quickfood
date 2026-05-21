"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll to top whenever the route changes.
 *
 * Next.js App Router *usually* restores scroll on navigation, but in practice
 * we hit cases where a long page (e.g. a menu scrolled near the bottom)
 * leaves the next page (cart, checkout) starting mid-scroll. This component
 * makes every route start at the top — on both mobile and desktop.
 *
 * Mounted once in the root layout. No UI.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Defer to next tick so we don't fight with browser's own scroll-restoration
    // when navigating with back/forward (those should NOT jump to top).
    const id = window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
