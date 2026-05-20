"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const SHOW_DELAY_MS = 150;
const TRICKLE_INTERVAL_MS = 200;
const FINISH_FADE_MS = 220;

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <RouteProgressInner />
    </Suspense>
  );
}

function RouteProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  const startedRef = useRef(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  function clearTimers() {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (trickleTimerRef.current) {
      clearInterval(trickleTimerRef.current);
      trickleTimerRef.current = null;
    }
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }

  function begin() {
    if (startedRef.current) return;
    startedRef.current = true;
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    showTimerRef.current = setTimeout(() => {
      setActive(true);
      setProgress(20);
      trickleTimerRef.current = setInterval(() => {
        setProgress((p) => (p >= 90 ? p : p + Math.max(1, (95 - p) * 0.12)));
      }, TRICKLE_INTERVAL_MS);
    }, SHOW_DELAY_MS);
  }

  function end() {
    if (!startedRef.current) return;
    startedRef.current = false;
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (trickleTimerRef.current) {
      clearInterval(trickleTimerRef.current);
      trickleTimerRef.current = null;
    }
    setProgress(100);
    finishTimerRef.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
      finishTimerRef.current = null;
    }, FINISH_FADE_MS);
  }

  // Detect link clicks that will trigger an internal navigation.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {
        return;
      }
      begin();
    }

    function onSubmit(e: SubmitEvent) {
      const form = e.target as HTMLFormElement | null;
      if (!form) return;
      // Only react to form posts that target same origin and are not handled by client JS.
      // Most app forms call event.preventDefault() and fetch manually — those won't reach here.
      if (form.dataset.routeProgress === "false") return;
      const action = form.getAttribute("action");
      if (!action) return;
      try {
        const url = new URL(action, window.location.href);
        if (url.origin !== window.location.origin) return;
      } catch {
        return;
      }
      begin();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // When the URL actually changes, finish.
  useEffect(() => {
    const key = `${pathname}?${searchParams?.toString() ?? ""}`;
    if (lastKeyRef.current === null) {
      lastKeyRef.current = key;
      return;
    }
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key;
      end();
    }
  }, [pathname, searchParams]);

  useEffect(() => () => clearTimers(), []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: active ? 1 : 0,
        transition: `opacity ${FINISH_FADE_MS}ms ease`,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "var(--qf-primary, #0e7a3c)",
          boxShadow: "0 0 8px var(--qf-primary, #0e7a3c)",
          transition: "width 240ms ease",
        }}
      />
    </div>
  );
}
