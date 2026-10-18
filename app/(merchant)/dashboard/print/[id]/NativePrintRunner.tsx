"use client";

import { useEffect, useState } from "react";
import {
  hasSunmiBridge,
  printReceipt,
  type ReceiptOrder,
  type ReceiptPrinterType,
  type ReceiptSettings,
} from "@/lib/receipt-print";

// Loaded by the Android wrapper in a hidden WebView when a new-order push
// arrives, so a backgrounded terminal still prints. The receipt is rastered by
// the same canvas the board uses - the native layer only ever sees a PNG, so
// receipt layout and settings stay in one place.

const HANDOFF_MS = 4_000;

export function NativePrintRunner({
  orderId,
  printer,
  settings,
}: {
  orderId: string;
  printer: ReceiptPrinterType;
  settings: ReceiptSettings;
}) {
  const [status, setStatus] = useState("מדפיס…");

  useEffect(() => {
    let released = false;
    // The service also times out on its own; this just releases it sooner.
    const release = () => {
      if (released) return;
      released = true;
      try {
        window.QuickFoodNative?.printDone?.();
      } catch {
        /* not running inside the app */
      }
    };

    (async () => {
      try {
        if (!settings.autoPrintOnNew) {
          setStatus("הדפסה אוטומטית כבויה");
          return release();
        }
        if (printer !== "sunmi" || !hasSunmiBridge()) {
          setStatus("אין מדפסת SUNMI מחוברת");
          return release();
        }
        const res = await fetch(`/api/v1/customer/orders/${orderId}`, { cache: "no-store" });
        if (!res.ok) {
          setStatus("טעינת ההזמנה נכשלה");
          return release();
        }
        const data = await res.json();
        const order = (data.order as ReceiptOrder | null) ?? null;
        if (!order) {
          setStatus("ההזמנה לא נמצאה");
          return release();
        }
        printReceipt(order, "sunmi", undefined, settings);
        setStatus("נשלח למדפסת");
        // printBase64 hands off to the AIDL service asynchronously - tearing the
        // WebView down the same tick can drop the job before it is queued.
        window.setTimeout(release, HANDOFF_MS);
      } catch {
        setStatus("ההדפסה נכשלה");
        release();
      }
    })();

    return release;
  }, [orderId, printer, settings]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-qf-mute">{status}</div>
  );
}
