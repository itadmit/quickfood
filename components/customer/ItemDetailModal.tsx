"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { IcoClose } from "@/components/shared/Icons";

const SWIPE_CLOSE_THRESHOLD = 110;
const SNAP_BACK_TRANSITION = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)";
const CLOSE_TRANSITION = "transform 240ms cubic-bezier(0.32, 0.72, 0, 1)";
const BACKDROP_FADE = "opacity 240ms ease-out";
const CLOSE_DURATION_MS = 260;

export function ItemDetailModal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const currentDyRef = useRef(0);
  const closingRef = useRef(false);

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
      onClose();
      return;
    }
    card.style.setProperty("animation", "none", "important");
    void card.offsetHeight;
    card.style.transition = CLOSE_TRANSITION;
    card.style.transform = "translate3d(0, 100%, 0)";
    backdrop.style.transition = BACKDROP_FADE;
    backdrop.style.opacity = "0";
    window.setTimeout(() => onClose(), CLOSE_DURATION_MS);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onHandleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1 || closingRef.current) return;
    startYRef.current = e.touches[0].clientY;
    currentDyRef.current = 0;
    const card = cardRef.current;
    if (card) {
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
          transform: "translate3d(0, 0, 0)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
