"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IcoGear, IcoClose } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

const DISMISS_KEY = "qf:merchant-preview-bar:dismissed";

/**
 * Floating bar rendered on customer-facing pages when the visitor is the
 * merchant who owns this tenant. Gives a one-tap shortcut back to the
 * dashboard so they can stop hunting through URLs to switch contexts.
 *
 * Visibility is gated server-side in the customer layout. The dismiss is
 * per-tab via sessionStorage - comes back next visit so the merchant keeps
 * the affordance, but stays out of the way during a focused session.
 */
export function MerchantPreviewBar({ tenantName }: { tenantName: string }) {
  // Render nothing on the server and on the first client paint, then opt-in
  // after we've read sessionStorage. Avoids the flash of "dismissed bar
  // briefly visible before JS resolves the dismissed state".
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div
      className={cn(
        // Mobile: sit above the bottom tab bar (which is bottom-0, ~64px tall).
        // Desktop: float at the bottom with a comfortable inset.
        "fixed bottom-20 inset-x-0 z-40 max-w-md mx-auto px-3",
        "lg:bottom-6 lg:left-6 lg:right-auto lg:max-w-fit lg:mx-0 lg:px-0",
        "animate-qf-preview-bar-in",
      )}
      role="region"
      aria-label="סרגל ניהול חנות"
    >
      <div className="bg-qf-ink text-white rounded-2xl shadow-lg shadow-black/20 px-3 py-2 flex items-center gap-2.5">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-white/10 grid place-items-center">
          <IcoGear c="#fff" s={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-white/60 leading-tight">אתה רואה את החנות שלך</div>
          <div className="text-sm font-semibold leading-tight truncate">{tenantName}</div>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-semibold rounded-xl px-3 h-9 inline-flex items-center transition active:scale-[0.98]"
        >
          ניהול החנות
        </Link>
        <button
          type="button"
          onClick={() => {
            sessionStorage.setItem(DISMISS_KEY, "1");
            setShow(false);
          }}
          aria-label="סגור"
          className="shrink-0 w-8 h-8 -mr-1 grid place-items-center text-white/50 hover:text-white transition"
        >
          <IcoClose c="currentColor" s={16} />
        </button>
      </div>
    </div>
  );
}
