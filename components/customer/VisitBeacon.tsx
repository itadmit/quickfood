"use client";

import { useEffect } from "react";

/**
 * Fires a single storefront-visit beacon per tab session. The server dedupes
 * to one row per visitor per day and bumps a counter, so re-fires across
 * sessions are cheap and correct. Renders nothing.
 */
export function VisitBeacon({ tenantSlug }: { tenantSlug: string }) {
  useEffect(() => {
    // Capture a QR/campaign arrival marker (?src=qr_xxx) once on landing, so it
    // survives the walk to checkout where the URL no longer carries it.
    try {
      const src = new URL(window.location.href).searchParams.get("src");
      if (src) sessionStorage.setItem("qf:src", src);
    } catch {
      /* ignore */
    }

    const key = `qf:visit:${tenantSlug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage blocked (private mode) - still beacon, server dedupes by day.
    }
    void fetch("/api/v1/public/track-visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_slug: tenantSlug }),
      keepalive: true,
    }).catch(() => {});
  }, [tenantSlug]);

  return null;
}
