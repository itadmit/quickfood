"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCart } from "@/components/customer/CartProvider";

const SCROLL_THRESHOLD = 180;

export function AIAdvisorTopButton() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { lines, hydrated } = useCart();
  const hasCartItems = hydrated && lines.length > 0;

  function open() {
    window.dispatchEvent(new CustomEvent("qf:open-ai-advisor"));
  }

  useEffect(() => {
    setMounted(true);
    const onScroll = () => {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showFloating = scrolled && !hasCartItems;

  const floating = (
    <button
      type="button"
      onClick={open}
      aria-label="פתח יועץ AI"
      dir="ltr"
      className={
        "fixed bottom-20 left-3 z-40 lg:hidden flex items-center bg-white rounded-full shadow-lg shadow-black/25 transition-[opacity,transform,padding,gap] duration-500 ease-out " +
        (showFloating
          ? "opacity-100 translate-y-0 pointer-events-auto gap-2 pl-1.5 pr-3.5 py-1.5"
          : "opacity-0 translate-y-3 pointer-events-none gap-0 p-1.5")
      }
    >
      <span className="grid w-6 h-6 place-items-center shrink-0">
        <Sparkle />
      </span>
      <span
        className={
          "text-sm font-bold whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-500 ease-out text-(--qf-deep) " +
          (showFloating ? "max-w-24 opacity-100" : "max-w-0 opacity-0")
        }
      >
        יועץ AI
      </span>
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="פתח יועץ AI"
        className="w-9 h-9 rounded-full bg-white grid place-items-center"
      >
        <Sparkle />
      </button>
      {mounted && createPortal(floating, document.body)}
    </>
  );
}

function Sparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"
        fill="var(--qf-deep)"
      />
      <path
        d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"
        fill="var(--qf-deep)"
      />
    </svg>
  );
}
