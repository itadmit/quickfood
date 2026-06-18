"use client";

import { useEffect } from "react";

/**
 * Fires a single storefront-visit beacon per tab session. The server dedupes
 * to one row per visitor per day and bumps a counter, so re-fires across
 * sessions are cheap and correct. Renders nothing.
 */
export function VisitBeacon({ tenantSlug }: { tenantSlug: string }) {
  useEffect(() => {
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
