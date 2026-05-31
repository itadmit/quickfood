"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IcoBell, IcoClock, IcoRefresh, IcoCheck } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

type KitchenStatus = "pending" | "confirmed" | "preparing" | "in_oven" | "ready";

interface Item {
  id: string;
  name: string;
  quantity: number;
  size: string | null;
  notes: string | null;
  preparedAt: string | null;
  options: Array<{ name: string; half?: "left" | "right" | "full" }>;
}

interface Order {
  id: string;
  number: string;
  status: KitchenStatus;
  method: "delivery" | "pickup";
  customerNotes: string | null;
  createdAt: string;
  items: Item[];
}

const STATUS_TONE: Record<KitchenStatus, { wrap: string; pill: string; label: string }> = {
  pending:    { wrap: "border-qf-tomato bg-white",       pill: "bg-qf-tomato-soft text-qf-tomato",       label: "חדשה" },
  confirmed:  { wrap: "border-(--qf-primary) bg-white",  pill: "bg-(--qf-soft) text-(--qf-deep)",         label: "אושרה" },
  preparing:  { wrap: "border-qf-yolk bg-white",         pill: "bg-qf-yolk-soft text-qf-ink",             label: "בהכנה" },
  in_oven:    { wrap: "border-orange-400 bg-white",      pill: "bg-orange-100 text-orange-800",           label: "בתנור" },
  ready:      { wrap: "border-qf-green bg-qf-green-soft", pill: "bg-qf-green text-white",                 label: "מוכנה" },
};

// Dedupe identical option entries (same name + half) into "name ×N"
// so a topping that lives in two modifier groups doesn't print twice.
function renderOptions(opts: Item["options"]): string {
  const m = new Map<string, { name: string; half?: string; count: number }>();
  for (const o of opts) {
    if (!o?.name) continue;
    const k = `${o.name}|${o.half ?? ""}`;
    const cur = m.get(k);
    if (cur) cur.count += 1;
    else m.set(k, { name: o.name, half: o.half, count: 1 });
  }
  return Array.from(m.values())
    .map((g) => {
      const base =
        g.half === "left"
          ? `${g.name} (חצי א׳)`
          : g.half === "right"
            ? `${g.name} (חצי ב׳)`
            : g.name;
      return g.count > 1 ? `${base} ×${g.count}` : base;
    })
    .join(" · ");
}

export function KitchenDisplay({ initial }: { initial: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initial);
  const [now, setNow] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  // Elapsed-minutes ticker. Throttled to 30s — Math.floor on the
  // minute counter means per-second updates would change nothing.
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/v1/merchant/orders?status=active", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const raw = data.orders as Array<Record<string, unknown>>;
      const next: Order[] = raw
        .filter((o) => {
          const s = o.status as string;
          return ["pending", "confirmed", "preparing", "in_oven", "ready"].includes(s);
        })
        .map((o) => ({
          id: o.id as string,
          number: o.number as string,
          status: o.status as KitchenStatus,
          method: o.method as "delivery" | "pickup",
          customerNotes: (o.customer_notes as string | null) ?? null,
          createdAt: o.created_at as string,
          items: ((o.items as Array<Record<string, unknown>>) || []).map((it) => {
            const opts = Array.isArray(it.options)
              ? (it.options as Array<{ name?: string; half?: string }>)
                  .filter((x) => typeof x?.name === "string")
                  .map((x) => ({
                    name: x.name as string,
                    half: x.half as "left" | "right" | "full" | undefined,
                  }))
              : [];
            return {
              id: it.id as string,
              name: it.name as string,
              quantity: it.quantity as number,
              size: (it.size as string | null) ?? null,
              notes: (it.notes as string | null) ?? null,
              preparedAt: (it.prepared_at as string | null) ?? null,
              options: opts,
            };
          }),
        }));
      next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setOrders(next);
    } finally {
      window.setTimeout(() => setRefreshing(false), 350);
    }
  }, []);

  function playChime() {
    if (soundMuted) return;
    const el = audioRef.current;
    if (!el) return;
    try {
      el.currentTime = 0;
      void el.play();
    } catch {
      /* ignore */
    }
  }

  // SSE — shared with the Kanban (one EventSource per browser, since
  // the route is the same URL). Refresh the whole list on any event;
  // patch-level diffing isn't worth it for a 100-row list.
  useEffect(() => {
    let cancelled = false;
    let backoffMs = 1000;
    let reconnectTimer: number | null = null;
    let es: EventSource | null = null;

    function open() {
      if (cancelled) return;
      es = new EventSource("/api/v1/realtime/merchant");
      es.addEventListener("open", () => {
        backoffMs = 1000;
      });
      es.addEventListener("order.created", () => {
        try {
          window.dispatchEvent(new Event("qf:new-order"));
        } catch {
          /* ignore */
        }
        playChime();
        void refresh();
      });
      es.addEventListener("order.status_changed", () => void refresh());
      es.addEventListener("order.items_edited", () => void refresh());
      es.addEventListener("order.item_prepared", () => void refresh());
      es.onerror = () => {
        es?.close();
        es = null;
        if (cancelled) return;
        if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(open, backoffMs);
        backoffMs = Math.min(backoffMs * 2, 30_000);
        void refresh();
      };
    }

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      void refresh();
      if (!es || es.readyState === EventSource.CLOSED) {
        if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
        backoffMs = 1000;
        open();
      }
    }

    open();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // Audio — same /sounds/new.mp3 as NewOrderChime so the UX matches.
  // iOS/Chrome block autoplay until a user gesture; unlock on the
  // first click anywhere.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("qf_kitchen_chime_muted");
    setSoundMuted(saved === "1");
    const el = new Audio("/sounds/new.mp3");
    el.preload = "auto";
    audioRef.current = el;
    function unlock() {
      const target = audioRef.current;
      if (!target || audioUnlockedRef.current) return;
      target.muted = true;
      target.play()
        .then(() => {
          target.pause();
          target.currentTime = 0;
          target.muted = false;
          audioUnlockedRef.current = true;
        })
        .catch(() => {
          /* ignore */
        });
    }
    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  function toggleMute() {
    const next = !soundMuted;
    setSoundMuted(next);
    localStorage.setItem("qf_kitchen_chime_muted", next ? "1" : "0");
  }

  async function toggleItem(orderId: string, itemId: string, prepared: boolean) {
    // Optimistic flip so the cook's tap feels immediate. SSE-driven
    // refresh reconciles.
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              items: o.items.map((it) =>
                it.id === itemId
                  ? { ...it, preparedAt: prepared ? new Date().toISOString() : null }
                  : it,
              ),
            }
          : o,
      ),
    );
    try {
      await fetch(`/api/v1/merchant/orders/${orderId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prepared }),
      });
    } catch {
      /* refresh via SSE */
    }
  }

  function minsSince(iso: string): number | null {
    if (now == null) return null;
    return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-qf-mute">מטבח</div>
          <h1 className="text-3xl font-black text-qf-ink">תור הזמנות</h1>
          <p className="text-sm text-qf-mute mt-0.5">
            {orders.length} הזמנות פתוחות · עדכון אוטומטי
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            title={soundMuted ? "סאונד מושתק — הקש להפעלה" : "סאונד פעיל — הקש להשתקה"}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-bold",
              soundMuted
                ? "bg-white border-qf-line-dash text-qf-mute"
                : "bg-qf-green-soft border-qf-green text-qf-green-deep",
            )}
          >
            <IcoBell c={soundMuted ? "#7c8a82" : "var(--qf-deep)"} s={16} />
            {soundMuted ? "סאונד מושתק" : "סאונד פעיל"}
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            title="רענון ידני"
            aria-label="רענון ידני"
            className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-white border-2 border-black text-black shadow-[0_2px_0_#000] hover:bg-black/5 disabled:opacity-60"
          >
            <IcoRefresh s={16} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-qf-line-dash p-16 text-center text-qf-mute text-lg">
          אין הזמנות פתוחות. כל הכבוד למטבח.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {orders.map((o) => {
            const tone = STATUS_TONE[o.status];
            const mins = minsSince(o.createdAt);
            const allPrepared =
              o.items.length > 0 && o.items.every((it) => it.preparedAt !== null);
            return (
              <article
                key={o.id}
                className={cn(
                  "rounded-2xl border-2 shadow-sm p-4 space-y-3 transition",
                  tone.wrap,
                  allPrepared && "ring-4 ring-qf-green/60",
                )}
              >
                <header className="flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black font-mono">{o.number}</span>
                    <span className={cn("text-xs font-bold px-2 py-1 rounded-md", tone.pill)}>
                      {tone.label}
                    </span>
                  </div>
                  <div className="text-sm text-qf-mute inline-flex items-center gap-1.5 tnum">
                    <IcoClock c="#7c8a82" s={14} />
                    {mins != null ? (mins === 0 ? "עכשיו" : `${mins} דק׳`) : ""}
                    <span aria-hidden>·</span>
                    {o.method === "delivery" ? "משלוח" : "איסוף"}
                  </div>
                </header>

                {o.customerNotes && (
                  <div className="text-sm bg-qf-yolk-soft border border-qf-yolk/40 rounded-lg px-3 py-2 text-qf-ink2">
                    {o.customerNotes}
                  </div>
                )}

                <ul className="space-y-2">
                  {o.items.map((it) => {
                    const prepared = it.preparedAt !== null;
                    const opts = renderOptions(it.options);
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => toggleItem(o.id, it.id, !prepared)}
                          className={cn(
                            "w-full text-right p-3 rounded-xl border-2 transition active:scale-[0.99] flex items-start gap-3",
                            prepared
                              ? "bg-qf-green-soft border-qf-green/40"
                              : "bg-white border-qf-line-dash hover:border-qf-ink/30",
                          )}
                        >
                          <span
                            className={cn(
                              "shrink-0 w-7 h-7 rounded-md border-2 grid place-items-center mt-0.5",
                              prepared ? "bg-qf-green border-qf-green" : "border-qf-line-dash bg-white",
                            )}
                            aria-hidden
                          >
                            {prepared && <IcoCheck c="#fff" s={14} />}
                          </span>
                          <div className={cn("flex-1 min-w-0", prepared && "line-through opacity-70")}>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-black tnum">{it.quantity}×</span>
                              <span className="text-lg font-bold">
                                {it.name}
                                {it.size ? ` · ${it.size}` : ""}
                              </span>
                            </div>
                            {opts && (
                              <div className="text-sm text-qf-ink2 mt-1">{opts}</div>
                            )}
                            {it.notes && (
                              <div className="text-sm text-qf-tomato font-bold mt-1">
                                הערה: {it.notes}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
