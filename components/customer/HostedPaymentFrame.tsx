"use client";

import { useEffect } from "react";

/**
 * Presents a hosted payment page (CardCom LowProfile) either by redirecting the
 * whole browser to it or by embedding it in an iframe - the merchant picks the
 * mode in settings. Payment completion is detected the same way for both: the
 * S2S webhook flips the order to paid and the surrounding page's status poll (or
 * the post-payment redirect back to our success URL) reflects it.
 *
 * This is the CardCom counterpart to GrowPaymentSdk's inline wallet.
 */
export function HostedPaymentFrame({
  paymentUrl,
  displayMode,
  title,
  heightPx = 640,
}: {
  paymentUrl: string;
  displayMode: "iframe" | "redirect";
  title?: string;
  heightPx?: number;
}) {
  useEffect(() => {
    if (displayMode === "redirect") {
      window.location.href = paymentUrl;
    }
  }, [paymentUrl, displayMode]);

  if (displayMode === "redirect") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="qf-spinner text-(--qf-primary)" aria-hidden />
        <p className="text-sm text-qf-mute">מעבירים אותך לעמוד התשלום המאובטח…</p>
      </div>
    );
  }

  return (
    <iframe
      src={paymentUrl}
      title={title ?? "תשלום מאובטח"}
      className="w-full rounded-2xl border border-qf-line bg-white"
      style={{ height: `${heightPx}px` }}
      allow="payment *"
    />
  );
}
