"use client";

import { useEffect } from "react";
import { sfPurchase, storefrontPixelReady } from "@/lib/fb/storefront";

/** Eligibility and cross-browser reservations live on the server. Storage is
 * only an acknowledgement recovery aid, never proof that Meta received it. */
export function StorePurchaseEvent({ orderId, pixelId, token }: {
  orderId: string; pixelId: string; token: string;
}) {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let claim: string | null = null;
    const key = `qf:purchase-ack:${pixelId}:${orderId}`;
    try { claim = localStorage.getItem(key); } catch { /* storage optional */ }
    const deadline = Date.now() + 30 * 60_000;

    async function attempt() {
      if (stopped || Date.now() > deadline) return;
      try {
        // A pending acknowledgement must be retried even if the library has
        // since disappeared. Otherwise don't reserve an event before readiness.
        if (!claim && !storefrontPixelReady(pixelId)) return;
        const res = await fetch("/api/v1/public/purchase-pixel", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderId, token, ...(claim ? { claim } : {}) }),
          keepalive: true,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.done) {
          stopped = true;
          try { localStorage.removeItem(key); } catch { /* storage optional */ }
          return;
        }
        if (stopped || !data.claim || data.pixelId !== pixelId) return;
        if (sfPurchase(pixelId, orderId, data.params)) {
          claim = data.claim;
          try { localStorage.setItem(key, claim!); } catch { /* storage optional */ }
          // Acknowledge only after fbq accepted the call. Failed requests are
          // retried without sending another Purchase in this browser.
          const ack = await fetch("/api/v1/public/purchase-pixel", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ orderId, token, claim }),
            keepalive: true,
          });
          if (ack.ok) {
            stopped = true;
            try { localStorage.removeItem(key); } catch { /* storage optional */ }
          }
        }
      } catch { /* transient network errors retry */ }
      finally {
        if (!stopped) timer = setTimeout(attempt, 3000);
      }
    }
    void attempt();
    return () => { stopped = true; clearTimeout(timer); };
  }, [orderId, pixelId, token]);
  return null;
}
