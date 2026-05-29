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

function detectIosNeedsInstall(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
  if (!isIos) return false;
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !isStandalone;
}

export function CourierPushSubscribe() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
    }
    setIosNeedsInstall(detectIosNeedsInstall());
    if (sessionStorage.getItem("qf_courier_push_dismissed") === "1") {
      setDismissed(true);
    }
    void registerSwSilently();
  }, []);

  async function registerSwSilently() {
    try {
      if (!("serviceWorker" in navigator)) return;
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw-courier.js")) ??
        (await navigator.serviceWorker.register("/sw-courier.js", { scope: "/" }));

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
      await fetch("/api/v1/courier/push/subscribe", {
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
    if (!VAPID_PUBLIC_KEY) {
      console.warn("[push] VAPID public key missing");
      return;
    }
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") return;

      let reg = await navigator.serviceWorker.getRegistration("/sw-courier.js");
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw-courier.js", { scope: "/" });
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

      await fetch("/api/v1/courier/push/subscribe", {
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
    sessionStorage.setItem("qf_courier_push_dismissed", "1");
    setDismissed(true);
  }

  if (permission === "unsupported") return null;
  if (permission === "granted") return null;
  if (dismissed) return null;

  if (iosNeedsInstall) {
    return (
      <div className="rounded-2xl bg-amber-500/15 border border-amber-500/30 p-4 space-y-2">
        <p className="font-semibold text-amber-100">קבל התראות גם כשהאפליקציה סגורה</p>
        <p className="text-xs text-amber-100/80">
          ב-iPhone: לחץ על כפתור השיתוף ב-Safari (ריבוע עם חץ) → &quot;הוסף למסך הבית&quot; → פתח מהאייקון
          ואשר התראות.
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs text-amber-100/70 underline"
        >
          סגירה
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-emerald-500/15 border border-emerald-500/30 p-4 space-y-3">
      <div>
        <p className="font-semibold text-emerald-100">אישור התראות</p>
        <p className="text-xs text-emerald-100/80">
          הפעלת התראות תאפשר לך לדעת על הזמנה חדשה גם כשהאפליקציה סגורה.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-[#062017] font-bold text-sm disabled:opacity-60"
        >
          {busy ? "מפעיל..." : "הפעל התראות"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="px-3 py-2.5 rounded-xl border border-emerald-500/30 text-emerald-100/80 text-xs"
        >
          לא עכשיו
        </button>
      </div>
    </div>
  );
}
