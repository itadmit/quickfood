"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRoom } from "@/lib/realtime/useRoom";
import { fetchWithSession } from "@/lib/auth/client-session";
import { IcoBell, IcoClose } from "@/components/shared/Icons";
import {
  CHIME_SETTINGS_EVENT,
  getChimeEnabled,
  getChimeLoopEnabled,
  getSelectedChime,
  playChime,
  startChimeLoop,
  stopChimeLoop,
  unlockChimeAudio,
} from "@/lib/order-chime";

type ActiveOrder = { id: string; number: string; status: string };

function subscribeChimeSettings(onChange: () => void) {
  window.addEventListener(CHIME_SETTINGS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHIME_SETTINGS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function hasOwnAlert(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname === "/dashboard/orders" ||
    pathname.startsWith("/dashboard/kitchen") ||
    pathname.startsWith("/dashboard/print")
  );
}

export function GlobalNewOrderAlert({ daysDelivery = false }: { daysDelivery?: boolean }) {
  const pathname = usePathname();
  const active = !hasOwnAlert(pathname);
  if (!active) return null;
  return <Listener daysDelivery={daysDelivery} />;
}

function Listener({ daysDelivery }: { daysDelivery: boolean }) {
  const [pending, setPending] = useState<ActiveOrder[]>([]);
  const [latest, setLatest] = useState<ActiveOrder | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const soundOn = useSyncExternalStore(subscribeChimeSettings, getChimeEnabled, () => false);
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    function unlock() {
      unlockChimeAudio();
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    }
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchWithSession("/api/v1/merchant/orders?status=active&per_page=100", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const fresh: ActiveOrder[] = ((data.orders as Array<Record<string, unknown>>) || []).map((o) => ({
        id: o.id as string,
        number: String(o.number ?? ""),
        status: o.status as string,
      }));
      const seen = seenRef.current;
      const newOnes = seen ? fresh.filter((o) => !seen.has(o.id)) : [];
      const nextSeen = seen ?? new Set<string>();
      for (const o of fresh) nextSeen.add(o.id);
      seenRef.current = nextSeen;
      const pendingNow = fresh.filter((o) => o.status === "pending");
      setPending(pendingNow);
      setLatest((prev) => {
        if (newOnes.length > 0) return newOnes[newOnes.length - 1];
        if (prev?.status === "pending" && !pendingNow.some((o) => o.id === prev.id)) return null;
        return prev;
      });
      if (newOnes.length > 0) {
        setDismissedId(null);
        const loopWillRing =
          !daysDelivery && getChimeLoopEnabled() && newOnes.some((o) => o.status === "pending");
        if (getChimeEnabled() && !loopWillRing) playChime(getSelectedChime());
      }
    } catch {
      /* ignore */
    }
  }, [daysDelivery]);

  useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  useRoom({
    scope: { scope: "merchant" },
    keepOpenWhenHidden: soundOn,
    onStatus: setConnected,
    onResync: () => void refresh(),
    onEvent: (event) => {
      if (event.startsWith("order.")) void refresh();
    },
  });

  useEffect(() => {
    if (connected) return;
    const id = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(id);
  }, [connected, refresh]);

  const waiting = !daysDelivery && pending.length > 0;
  useEffect(() => {
    if (waiting && soundOn && getChimeLoopEnabled()) startChimeLoop(getSelectedChime());
    else stopChimeLoop();
  }, [waiting, soundOn]);
  useEffect(() => () => stopChimeLoop(), []);

  const bannerOrder = pending.length > 0 ? pending[pending.length - 1] : latest;
  if (!bannerOrder || bannerOrder.id === dismissedId) return null;
  const count = pending.length;

  return (
    <div
      role="alert"
      className="fixed top-3 inset-x-3 sm:inset-x-auto sm:inset-e-6 z-[60] sm:w-96 rounded-2xl border-2 border-black bg-[#F8CB1E] text-black shadow-[0_4px_0_#000] p-3 flex items-center gap-3 animate-[pulse_1.6s_ease-in-out_infinite]"
    >
      <span className="shrink-0 w-10 h-10 rounded-full bg-black flex items-center justify-center">
        <IcoBell c="#F8CB1E" s={20} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm">
          {count > 1 ? `${count} הזמנות חדשות ממתינות` : `הזמנה חדשה #${bannerOrder.number}`}
        </div>
        <div className="text-xs">
          {count > 0 ? "ממתינה לאישור" : "התקבלה הזמנה חדשה"}
          {!soundOn && " · הסאונד מושתק במכשיר הזה"}
        </div>
      </div>
      <Link
        href="/dashboard/orders"
        className="shrink-0 px-3 py-2 rounded-xl bg-black text-[#F8CB1E] font-bold text-sm"
      >
        למסך ההזמנות
      </Link>
      {count === 0 && (
        <button
          type="button"
          aria-label="סגירה"
          onClick={() => setDismissedId(bannerOrder.id)}
          className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-black/10"
        >
          <IcoClose s={16} />
        </button>
      )}
    </div>
  );
}
