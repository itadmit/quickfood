"use client";

import { useEffect } from "react";

/**
 * Bounces the customer to `path` after a payment return, breaking OUT of the
 * payment iframe when needed.
 *
 * CardCom (iframe display mode) redirects to our success/failed URL *inside*
 * the embedded LowProfile iframe - a plain navigation would render the order
 * page cramped inside that little frame. So when we detect we're framed, we
 * drive the TOP window instead. In redirect mode (and Grow's Bit/PayBox hops)
 * we're already top-level, so it's a normal navigation.
 */
export function CheckoutRedirect({ path }: { path: string }) {
  useEffect(() => {
    try {
      if (window.top && window.top !== window.self) {
        // Same-origin top window (our own checkout page) - allowed.
        window.top.location.href = path;
        return;
      }
    } catch {
      // Cross-origin access to window.top threw - fall through to a
      // same-window navigation.
    }
    window.location.replace(path);
  }, [path]);

  return (
    <main dir="rtl" className="min-h-screen bg-[#FFFBEC] grid place-items-center p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="w-8 h-8 rounded-full border-4 border-black/15 border-t-black animate-spin"
          aria-hidden
        />
        <p className="text-sm text-black/70">מעבירים אותך…</p>
      </div>
    </main>
  );
}
