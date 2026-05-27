"use client";

import { useEffect, useRef, useState } from "react";
import { IcoClose } from "@/components/shared/Icons";
import { AIAdvisorModal } from "./AIAdvisorModal";

const COOKIE_NAME = "qf_ai_promo_dismissed";
const DISMISS_DAYS = 7;
const OPEN_DELAY_MS = 1500;

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function AIAdvisorPromoPopup({
  tenantSlug,
  tenantName,
  suggestions,
}: {
  tenantSlug: string;
  tenantName: string;
  suggestions?: string[];
}) {
  const [showPromo, setShowPromo] = useState(false);
  const [showAdvisor, setShowAdvisor] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (getCookie(COOKIE_NAME) === "1") return;
    const t = window.setTimeout(() => setShowPromo(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!showPromo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWithoutCookie();
    };
    const onClick = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        closeWithoutCookie();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPromo]);

  // Soft-close: hides the popup for THIS render but doesn't set a cookie.
  // Next page load shows it again. Used for X, Esc, outside click, and
  // even when the user opens the advisor — none of those count as a
  // "not interested" signal.
  function closeWithoutCookie() {
    setShowPromo(false);
  }

  // Hard-close: explicit "לא תודה" — write the 7-day cookie so the
  // popup stays dismissed across visits.
  function dismissForWeek() {
    setShowPromo(false);
    setCookie(COOKIE_NAME, "1", DISMISS_DAYS);
  }

  function openAdvisor() {
    setShowPromo(false);
    setShowAdvisor(true);
  }

  return (
    <>
      {showPromo && (
        <div
          className="fixed inset-0 z-[55] bg-black/40 grid place-items-center p-4 animate-qf-modal-in"
          role="dialog"
          aria-modal
        >
          <div
            ref={cardRef}
            className="relative w-full max-w-sm bg-white rounded-3xl border-2 border-black shadow-[0_4px_0_#000] overflow-hidden"
          >
            <button
              type="button"
              onClick={closeWithoutCookie}
              aria-label="סגור"
              className="absolute top-3 left-3 w-8 h-8 rounded-full bg-white border border-qf-line-dash hover:bg-qf-line-soft grid place-items-center z-10"
            >
              <IcoClose s={16} />
            </button>

            <div className="bg-(--qf-yolk) px-5 pt-7 pb-5 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-black grid place-items-center mb-3">
                <SparkleWhite />
              </div>
              <h2 className="font-black text-xl leading-tight text-black">
                לא יודע מה להזמין?
              </h2>
              <p className="text-sm text-black/70 mt-1.5 leading-relaxed">
                היועץ של {tenantName} מכיר את כל התפריט וימצא לך את ההזמנה המושלמת בכמה שאלות.
              </p>
            </div>

            <div className="p-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={openAdvisor}
                className="w-full px-4 py-3 rounded-2xl bg-black hover:bg-black/85 text-white font-bold text-sm flex items-center justify-center gap-2 transition"
              >
                <SparkleWhite s={16} />
                פתח שיחה עם היועץ
              </button>
              <button
                type="button"
                onClick={dismissForWeek}
                className="w-full px-4 py-2 rounded-2xl text-qf-mute hover:bg-qf-line-soft text-sm transition"
              >
                לא תודה
              </button>
            </div>
          </div>
        </div>
      )}
      {showAdvisor && (
        <AIAdvisorModal
          tenantSlug={tenantSlug}
          suggestions={suggestions}
          onClose={() => setShowAdvisor(false)}
        />
      )}
    </>
  );
}

function SparkleWhite({ s = 22 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#ffffff" aria-hidden>
      <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
      <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" />
    </svg>
  );
}
