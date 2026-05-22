"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Force every route change to start at the very top — no remembered scroll
 * position, no mid-page jump, no "I just scrolled to the bottom of a long
 * menu, why is the item page also at the bottom?" surprise.
 *
 * Two pieces of state to fight:
 *
 * 1) Browser scroll-restoration. On back/forward navigation the browser by
 *    default tries to put scroll back where it was — we override that with
 *    history.scrollRestoration = "manual" on mount, then restore it on
 *    unmount so we play nice with any other root that didn't opt in.
 *
 * 2) Next.js App Router's own scroll handling. On forward Link nav it
 *    already scrolls to top, but the timing can race with our component
 *    boundaries / nested layouts. We just hard-reset on every pathname
 *    change after the new tree has committed — twice, immediately and one
 *    frame later — to cover both "next paints" and "browser restored
 *    after paint."
 *
 * Mounted once in the root layout.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  // Turn off the browser's auto-scroll-restoration once, app-wide.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const previous = window.history.scrollRestoration;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    return () => {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = previous;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Immediate — covers normal forward nav.
    jumpToTop();
    // Next frame — covers cases where the browser's restoration nudges the
    // page mid-paint on back/forward, or where the new layout is still
    // mounting its children when our effect fires.
    const raf = window.requestAnimationFrame(() => jumpToTop());
    return () => window.cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}

function jumpToTop() {
  // window.scrollTo handles most browsers; documentElement / scrollingElement
  // fallbacks cover quirky setups (older iOS Safari, custom scroll containers
  // on <html>). All cheap, no harm running every time.
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } catch {
    window.scrollTo(0, 0);
  }
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;
}
