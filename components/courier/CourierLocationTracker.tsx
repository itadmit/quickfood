"use client";

import { useEffect, useRef } from "react";

const PING_INTERVAL_MS = 30_000;

export function CourierLocationTracker({ enabled }: { enabled: boolean }) {
  const lastSentAt = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    function sendOnce() {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const now = Date.now();
          if (now - lastSentAt.current < PING_INTERVAL_MS - 1500) return;
          lastSentAt.current = now;
          try {
            await fetch("/api/v1/courier/location", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
              }),
              keepalive: true,
            });
          } catch {
            /* silent */
          }
        },
        () => {
          /* silent - courier may have denied permission */
        },
        { enableHighAccuracy: true, maximumAge: 15_000, timeout: 12_000 },
      );
    }

    sendOnce();
    const id = setInterval(sendOnce, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled]);

  return null;
}
