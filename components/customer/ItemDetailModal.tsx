"use client";

import { useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { IcoClose } from "@/components/shared/Icons";

/**
 * Wrapper rendered by the intercepting route
 * app/(customer)/[tenantSlug]/@modal/(.)menu/[itemId]/page.tsx.
 *
 * Provides the modal chrome (backdrop, scrollable card, close X) and
 * leaves the actual product UI to the `<ItemDetail inModal />` child
 * that's passed in. Close → router.back() pops the intercepted route
 * off the history stack and reveals the menu underneath without a
 * full page transition.
 *
 * Locks body scroll while open so the underlying menu doesn't peek-
 * scroll when the customer scrolls a long item.
 */
export function ItemDetailModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Scroll lock — `<html>` is the scroll container, so setting overflow:
  // hidden on it freezes the page exactly where it is without touching
  // `<body>`'s flow. The earlier position:fixed approach was capturing
  // scrollY too late (after some layout shift had already moved the
  // visible viewport), which made the background look like it had
  // scrolled to top during the modal-open animation. useLayoutEffect
  // applies the lock synchronously, before the browser gets a chance
  // to paint anything in-between.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    // Compensate for the disappearing scrollbar so the layout doesn't
    // shift horizontally when the modal opens on platforms where the
    // scrollbar takes width (Windows/Linux).
    const scrollbarWidth = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      html.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, []);

  // Esc-to-close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/60 sm:p-6"
      onClick={(e) => {
        // Backdrop click closes — guard against clicks inside the
        // card propagating up via the stop in the inner div.
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div
        className="relative w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl sm:shadow-xl overflow-hidden max-h-[92dvh] sm:max-h-[92vh] animate-qf-sheet-in sm:animate-qf-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="סגור"
          className="absolute top-4 inset-s-4 z-50 w-9 h-9 rounded-full grid place-items-center bg-white/95 backdrop-blur text-qf-ink shadow-md hover:bg-white transition"
        >
          <IcoClose s={14} c="currentColor" />
        </button>

        {/* Scrollable body. Scrollbars hidden so the hero image goes truly
            edge-to-edge (otherwise the gutter steals width on Windows/Linux
            and on RTL Macs). The ItemDetail screen has its own bottom CTA
            bar (`fixed bottom-0 ...`); inside the modal it sits anchored to
            the modal's containing block — visible while you scroll. */}
        <div className="overflow-y-auto max-h-[92dvh] sm:max-h-[92vh] scrollbar-none [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
