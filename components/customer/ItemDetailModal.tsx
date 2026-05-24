"use client";

import { useEffect } from "react";
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

  // Body scroll lock — restore on unmount so direct navigation away
  // (clicking "add to cart" → cart page) leaves the body in a clean
  // overflow state.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
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
        className="relative w-full sm:max-w-2xl bg-white sm:rounded-3xl sm:border-2 sm:border-black sm:shadow-[0_6px_0_#000] overflow-hidden max-h-[100dvh] sm:max-h-[92vh] animate-qf-check-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="סגור"
          className="absolute top-3 inset-s-3 z-50 w-10 h-10 rounded-full grid place-items-center bg-white text-black border-2 border-black shadow-[0_2px_0_#000] hover:shadow-[0_3px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] transition"
        >
          <IcoClose s={16} c="currentColor" />
        </button>

        {/* Scrollable body. The ItemDetail screen has its own bottom
            CTA bar (`fixed bottom-0 ...`); inside the modal that's
            still anchored to the viewport, which is the desired UX
            (CTA visible while you scroll the modal content). */}
        <div className="overflow-y-auto max-h-[100dvh] sm:max-h-[92vh]">
          {children}
        </div>
      </div>
    </div>
  );
}
