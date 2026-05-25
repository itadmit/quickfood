"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { IcoClose } from "@/components/shared/Icons";

const SWIPE_CLOSE_THRESHOLD = 110;
const SNAP_BACK_TRANSITION = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
const CLOSE_TRANSITION = "transform 240ms cubic-bezier(0.32, 0.72, 0, 1)";
const BACKDROP_FADE = "opacity 240ms ease-out";
const CLOSE_DURATION_MS = 260;

/**
 * Wrapper rendered by the intercepting route
 * app/(customer)/s/[tenantSlug]/@modal/(.)menu/[itemId]/page.tsx.
 *
 * Provides the modal chrome (backdrop, scrollable card, close X) and
 * leaves the actual product UI to the `<ItemDetail inModal />` child
 * that's passed in.
 *
 * Close behaviour (any trigger — X tap, Esc, backdrop tap, swipe past
 * threshold) plays the same exit animation: card slides DOWN to the
 * viewport bottom while the backdrop fades, then router.back() fires
 * to actually pop the intercepted route off the history stack. The
 * mount/unmount becomes invisible because the user only sees the slide.
 *
 * On mobile, a Wolt-style drag handle sits at the top of the card.
 * Drag-tracking writes the transform directly via ref (no React state
 * round-trip) so the card stays glued to the finger frame-by-frame.
 */
export function ItemDetailModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const currentDyRef = useRef(0);
  const closingRef = useRef(false);

  // Scroll lock — `<html>` is the scroll container, so setting overflow:
  // hidden on it freezes the page exactly where it is without touching
  // `<body>`'s flow.
  useLayoutEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
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

  function setCardTransform(dy: number) {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = `translate3d(0, ${dy}px, 0)`;
  }

  function close() {
    if (closingRef.current) return;
    closingRef.current = true;
    const card = cardRef.current;
    const backdrop = backdropRef.current;
    if (!card || !backdrop) {
      router.back();
      return;
    }
    // The open animation (`animate-qf-sheet-in`) uses `fill-mode: both`,
    // so its final keyframe (translateY(0)) keeps overriding our inline
    // transform — the close looks like a pure fade because the card
    // never actually moves. Kill the animation with !important so the
    // inline transform wins, then trigger the slide-down.
    card.style.setProperty("animation", "none", "important");
    // Force layout so the browser registers the animation removal before
    // we change transform; without this Safari occasionally collapses both
    // writes into a single frame and skips the transition.
    void card.offsetHeight;
    card.style.transition = CLOSE_TRANSITION;
    card.style.transform = "translate3d(0, 100%, 0)";
    backdrop.style.transition = BACKDROP_FADE;
    backdrop.style.opacity = "0";
    // setTimeout (not transitionend) guarantees we fire even if the
    // browser swallows the event during unmount.
    window.setTimeout(() => router.back(), CLOSE_DURATION_MS);
  }

  // Esc-to-close.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onHandleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1 || closingRef.current) return;
    startYRef.current = e.touches[0].clientY;
    currentDyRef.current = 0;
    const card = cardRef.current;
    if (card) {
      // Kill the snap-back transition so the card sticks to the finger
      // without lag.
      card.style.transition = "none";
    }
  }

  function onHandleTouchMove(e: React.TouchEvent) {
    if (startYRef.current === null) return;
    const dy = Math.max(0, e.touches[0].clientY - startYRef.current);
    currentDyRef.current = dy;
    setCardTransform(dy);
  }

  function onHandleTouchEnd() {
    if (startYRef.current === null) return;
    const passed = currentDyRef.current > SWIPE_CLOSE_THRESHOLD;
    startYRef.current = null;
    currentDyRef.current = 0;
    if (passed) {
      // close() takes the card from its current drag offset all the way
      // down to 100% — CSS transition handles the smoothing.
      close();
    } else {
      const card = cardRef.current;
      if (card) {
        card.style.transition = SNAP_BACK_TRANSITION;
      }
      setCardTransform(0);
    }
  }

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/60 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={cardRef}
        className="relative w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl sm:shadow-xl overflow-hidden max-h-[92dvh] sm:max-h-[92vh] animate-qf-sheet-in sm:animate-qf-modal-in"
        style={{
          // translateZ(0) promotes the card to its own GPU layer — fixes the
          // ~1px subpixel sliver that iOS Safari leaves at the top edge when
          // a rounded-t corner meets a static image during the slide-in.
          transform: "translate3d(0, 0, 0)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile only). Touch surface spans the top 28px
            so the gesture catches imprecise thumb swipes, and sits OVER
            the hero image (z-30) so no white strip appears above. */}
        <div
          className="sm:hidden absolute top-0 inset-x-0 h-7 z-30 flex items-start justify-center pt-1.5 touch-none"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
          onTouchCancel={onHandleTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-white/85 shadow-sm" />
        </div>

        <button
          type="button"
          onClick={close}
          aria-label="סגור"
          className="absolute top-4 inset-s-4 z-50 w-9 h-9 rounded-full grid place-items-center bg-white/95 backdrop-blur text-qf-ink shadow-md hover:bg-white transition"
        >
          <IcoClose s={14} c="currentColor" />
        </button>

        <div className="overflow-y-auto max-h-[92dvh] sm:max-h-[92vh] scrollbar-none [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
