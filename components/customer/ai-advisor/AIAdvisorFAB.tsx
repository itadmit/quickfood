"use client";

import { useEffect, useState } from "react";
import { AIAdvisorModal } from "./AIAdvisorModal";

const HINT_KEY = "qf:ai-advisor-hinted";
const SCROLL_THRESHOLD = 220;

export function AIAdvisorFAB({ tenantSlug }: { tenantSlug: string }) {
  const [open, setOpen] = useState(false);
  const [hintPhase, setHintPhase] = useState<"idle" | "pulse" | "bubble" | "done">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    let alreadyHinted = false;
    try {
      alreadyHinted = sessionStorage.getItem(HINT_KEY) === "1";
    } catch {
      /* sessionStorage unavailable */
    }
    if (alreadyHinted) {
      setHintPhase("done");
      return;
    }

    const onScroll = () => {
      if (window.scrollY < SCROLL_THRESHOLD) return;
      window.removeEventListener("scroll", onScroll);
      setHintPhase("pulse");
      try {
        sessionStorage.setItem(HINT_KEY, "1");
      } catch {
        /* ignore */
      }
      window.setTimeout(() => setHintPhase("bubble"), 900);
      window.setTimeout(() => setHintPhase("done"), 6500);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const showPulse = hintPhase === "pulse" || hintPhase === "bubble";
  const showBubble = hintPhase === "bubble";

  return (
    <>
      <div className="fixed bottom-24 left-4 z-40 lg:bottom-6">
        {showBubble && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute bottom-full left-0 mb-2 whitespace-nowrap rounded-2xl bg-white px-3.5 py-2 text-right text-xs font-bold text-black shadow-lg border-2 border-black animate-qf-bubble-in"
          >
            <span className="block">צריך עזרה לבחור?</span>
            <span className="block text-qf-mute text-[11px] font-medium mt-0.5">תשאל אותי, אני יודע את התפריט</span>
            <span
              aria-hidden
              className="absolute bottom-[-7px] left-6 w-3 h-3 bg-white border-b-2 border-l-2 border-black rotate-[-45deg]"
            />
          </button>
        )}
        <div className="relative">
          {showPulse && (
            <>
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-(--qf-yolk) opacity-70 animate-ping"
                style={{ animationDuration: "1.4s", animationIterationCount: 3 }}
              />
              <span
                aria-hidden
                className="absolute -inset-1 rounded-full bg-(--qf-yolk) opacity-30 animate-ping"
                style={{ animationDuration: "1.8s", animationIterationCount: 3, animationDelay: "0.2s" }}
              />
            </>
          )}
          <button
            type="button"
            aria-label="פתח יועץ AI"
            onClick={() => setOpen(true)}
            className="relative flex items-center gap-2 rounded-full bg-black text-white px-4 py-3 shadow-lg shadow-black/20 border-2 border-black hover:scale-105 active:scale-95 transition"
          >
            <SparkleIcon />
            <span className="text-sm font-bold whitespace-nowrap">יועץ AI</span>
          </button>
        </div>
      </div>
      {open && <AIAdvisorModal tenantSlug={tenantSlug} onClose={() => setOpen(false)} />}
    </>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"
        fill="#ffffff"
      />
      <path
        d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z"
        fill="#ffffff"
      />
    </svg>
  );
}
