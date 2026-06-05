"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// useLayoutEffect warns when running on the server (it's a no-op there).
// Pick the right hook based on environment so the scroll reset happens
// SYNCHRONOUSLY before paint on the client, but doesn't trip SSR.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Force every route change to start at the very top - no remembered scroll
 * position, no mid-page jump, no "I just scrolled to the bottom of a long
 * menu, why is the item page also at the bottom?" surprise.
 *
 * Two pieces of state to fight:
 *
 * 1) Browser scroll-restoration. On back/forward navigation the browser by
 *    default tries to put scroll back where it was - we override that with
 *    history.scrollRestoration = "manual" on mount, then restore it on
 *    unmount so we play nice with any other root that didn't opt in.
 *
 * 2) Next.js App Router's own scroll handling. On forward Link nav it
 *    already scrolls to top, but the timing can race with our component
 *    boundaries / nested layouts. We just hard-reset on every pathname
 *    change after the new tree has committed - twice, immediately and one
 *    frame later - to cover both "next paints" and "browser restored
 *    after paint."
 *
 * Mounted once in the root layout.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

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

  // iOS Safari (and Firefox to a lesser extent) keep the page in their
  // back-forward cache after the user leaves. When they return, the DOM
  // is restored verbatim - no remount, so the pathname effect below
  // never fires - and the page reads at whatever scroll position they
  // left it in. Most often the merchant lands in the middle of the
  // menu list with no idea how they got there. `pageshow` with
  // `persisted=true` is the documented signal for that restore.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) jumpToTop();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // useLayoutEffect runs synchronously after the DOM is updated but BEFORE
  // the browser paints - so the user never sees the mid-scroll frame on the
  // new route. The earlier useEffect-based version sometimes flashed the
  // previous scroll position on cart → checkout because by the time the
  // browser scheduled the post-paint effect, the new layout had already
  // rendered at the old scroll position.
  useIsoLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    // Skip the reset for intercepted-modal open/close transitions
    // (storefront ↔ item-detail). The pathname changes, but visually
    // only a modal opens/closes - resetting scroll yanks the menu
    // behind the modal to the top, which the customer perceives as
    // the background jumping.
    if (isInterceptedModalTransition(prev, pathname)) return;
    jumpToTop();
    // Then again next frame for the back/forward + streaming-Suspense cases
    // where the new layout's children mount AFTER our sync effect runs.
    const raf = window.requestAnimationFrame(() => jumpToTop());
    // And once more after layout settles (50ms) - covers iOS Safari URL-bar
    // shrink + Next.js streaming a second chunk in the same tick.
    const tid = window.setTimeout(() => jumpToTop(), 50);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(tid);
    };
  }, [pathname]);

  return null;
}

// Matches `/s/[tenantSlug]/menu/[itemId]` - the only route currently mounted
// behind an intercepting `@modal/(.)` slot. If a second modal-intercepted
// route is added, extend this matcher.
const ITEM_MODAL_RE = /^\/s\/([^/]+)\/menu\/[^/]+\/?$/;

function isInterceptedModalTransition(prev: string, next: string): boolean {
  const prevMatch = prev.match(ITEM_MODAL_RE);
  const nextMatch = next.match(ITEM_MODAL_RE);
  // Modal opening: next is the item URL, prev is on the same tenant.
  if (nextMatch && isSameTenant(prev, nextMatch[1])) return true;
  // Modal closing: prev was the item URL, next is on the same tenant.
  if (prevMatch && isSameTenant(next, prevMatch[1])) return true;
  return false;
}

function isSameTenant(path: string, slug: string): boolean {
  return path === `/s/${slug}` || path.startsWith(`/s/${slug}/`);
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
