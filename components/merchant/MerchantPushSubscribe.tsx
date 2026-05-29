"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes;
}

export function MerchantPushSubscribe() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      typeof Notification === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }
    if (localStorage.getItem("qf_merchant_push_dismissed") === "1") {
      setDismissed(true);
    }
    void registerSwSilently();
  }, []);

  async function registerSwSilently() {
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw-merchant.js")) ??
        (await navigator.serviceWorker.register("/sw-merchant.js", { scope: "/" }));

      if (Notification.permission !== "granted" || !VAPID_PUBLIC_KEY) return;
      await navigator.serviceWorker.ready;
      const existingSub = await reg.pushManager.getSubscription();
      const sub =
        existingSub ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        }));
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
      await fetch("/api/v1/merchant/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }

  async function enable() {
    if (!VAPID_PUBLIC_KEY) return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;
      let reg = await navigator.serviceWorker.getRegistration("/sw-merchant.js");
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw-merchant.js", { scope: "/" });
      }
      await navigator.serviceWorker.ready;
      const existingSub = await reg.pushManager.getSubscription();
      const sub =
        existingSub ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        }));
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
      await fetch("/api/v1/merchant/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }),
      });
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem("qf_merchant_push_dismissed", "1");
    setDismissed(true);
  }

  if (permission === "unsupported") return null;
  if (permission === "granted") return null;
  if (dismissed) return null;

  return (
    <div className="mb-3 rounded-xl bg-(--qf-primary)/10 border border-(--qf-primary)/30 p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">קבל סאונד והתראה על הזמנה חדשה</p>
        <p className="text-xs text-qf-mute">
          גם כשהדפדפן ברקע או הטלפון נעול
        </p>
      </div>
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        className="px-3 py-1.5 rounded-lg bg-black text-[#F8CB1E] text-xs font-bold disabled:opacity-60 whitespace-nowrap"
      >
        {busy ? "מפעיל..." : "הפעלה"}
      </button>
      <button
        type="button"
        onClick={dismiss}
        className="text-qf-mute hover:text-qf-ink text-xs"
      >
        לא עכשיו
      </button>
    </div>
  );
}
