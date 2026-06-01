"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IcoClock, IcoPhone, IcoPrinter, IcoFlame, IcoRefresh, IcoUndo } from "@/components/shared/Icons";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { OrderDrawer } from "@/components/merchant/OrderDrawer";
import { ManualOrderModal } from "@/components/merchant/ManualOrderModal";
import { AssignCourierModal } from "@/components/merchant/AssignCourierModal";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { NewOrderChime } from "@/components/merchant/NewOrderChime";

type Status =
  | "pending"
  | "confirmed"
  | "preparing"
  | "in_oven"
  | "ready"
  | "out_for_delivery";

type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

interface OrderRow {
  id: string;
  number: string;
  status: Status;
  method: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  customerNotes: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  total: number;
  createdAt: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    size: string | null;
    options: Array<{ name: string; half?: "left" | "right" | "full" }>;
    notes: string | null;
  }>;
}

// Group selected options by display key (name + half) so a topping
// that appears in two modifier groups shows up as "עגבניה ×2" instead
// of "עגבניה · עגבניה" — same helper as the order drawer.
function renderItemOptions(opts: Array<{ name?: string; half?: string }>): string {
  const groups = new Map<string, { name: string; half?: string; count: number }>();
  for (const o of opts) {
    if (!o?.name) continue;
    const key = `${o.name}|${o.half ?? ""}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { name: o.name, half: o.half, count: 1 });
  }
  return Array.from(groups.values())
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

const COLUMNS: Array<{
  status: Status[];
  title: string;
  subtitle: string;
  next: Status;
  actionLabel: string;
}> = [
  {
    status: ["pending", "confirmed"],
    title: "חדשות",
    // The column holds both pending (need merchant approval — usually
    // cash orders or card orders whose Grow callback hasn't landed)
    // AND confirmed (Grow already approved the payment, just waiting
    // for the merchant to start cooking). Per-card actionLabel below
    // splits the wording.
    subtitle: "ממתינות לקבלה",
    next: "preparing",
    actionLabel: "אשר וקבל",
  },
  {
    status: ["preparing", "in_oven"],
    title: "בהכנה",
    subtitle: "בתנור",
    next: "ready",
    actionLabel: "סמן כמוכן",
  },
  {
    status: ["ready"],
    title: "מוכנות",
    subtitle: "ממתינות לשליח/איסוף",
    next: "out_for_delivery",
    actionLabel: "מסור לשליח",
  },
  {
    status: ["out_for_delivery"],
    title: "יצאו למשלוח",
    subtitle: "בדרך ללקוח",
    next: "out_for_delivery", // delivered — handled separately
    actionLabel: "סמן כנמסר",
  },
];

const SLA_MINUTES_BEFORE_LATE = 15;

// Reverse map for the "חזרה שלב" undo button on each card. Only states
// past the "new orders" column have a meaningful previous — going from
// confirmed back to pending just un-accepts the order, which the merchant
// can do via cancel + recreate; not worth a one-tap arrow that clutters
// every new card. Past out_for_delivery stays locked too — courier
// wallet/route is tied to it, use refund/cancel instead.
const PREVIOUS_STATUS: Partial<Record<Status, Status>> = {
  preparing: "confirmed",
  in_oven: "preparing",
  ready: "preparing",
};

export function OrdersKanban({ initial }: { initial: OrderRow[] }) {
  const [orders, setOrders] = useState<OrderRow[]>(initial);
  // `now` stays null until after mount so SSR and the first client paint
  // agree on the "elapsed minutes" text (React #418 protection). The card
  // hides the elapsed counter when now=null and reveals it on the first
  // post-mount effect tick.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Track orders the user just optimistically advanced. When the SSE
  // fires "order.status_changed" we refresh — but the new list often
  // hasn't yet caught the PATCH we just sent (write-then-read on Neon
  // can lag a few hundred ms), so without this the card visibly jumps
  // back to the old column then forward again. expiresAt acts as a
  // fallback in case the PATCH silently fails: after 3s the optimistic
  // mark is dropped and the next refresh shows the real server state.
  const pendingAdvancesRef =
    useRef<Map<string, { target: Status | "delivered"; expiresAt: number }>>(new Map());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/merchant/orders?status=active", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const fresh: OrderRow[] = (data.orders as Array<Record<string, unknown>>).map((o) => ({
        id: o.id as string,
        number: o.number as string,
        status: o.status as Status,
        method: o.method as "delivery" | "pickup",
        paymentStatus: (o.payment_status as PaymentStatus) ?? "pending",
        paymentMethod: (o.payment_method as string) ?? "cash",
        customerName:
          (o.customer as { name?: string } | null)?.name ||
          (o.customer_name as string | null) ||
          "אורח",
        customerPhone:
          (o.customer as { phone?: string } | null)?.phone ||
          (o.customer_phone as string | null) ||
          "",
        customerNotes: (o.customer_notes as string | null) ?? null,
        total: o.total as number,
        createdAt: o.created_at as string,
        items: ((o.items as Array<Record<string, unknown>>) || []).map((it) => ({
          id: it.id as string,
          name: it.name as string,
          quantity: it.quantity as number,
          size: (it.size as string | null) ?? null,
          options: Array.isArray(it.options)
            ? (it.options as Array<{ name?: string; half?: string }>)
                .filter((o) => typeof o?.name === "string")
                .map((o) => ({ name: o.name as string, half: o.half as "left" | "right" | "full" | undefined }))
            : [],
          notes: (it.notes as string | null) ?? null,
        })),
      }));
      const pending = pendingAdvancesRef.current;
      const now = Date.now();
      for (const [id, entry] of pending) {
        if (entry.expiresAt < now) pending.delete(id);
      }
      const next = fresh
        .map((o) => {
          const entry = pending.get(o.id);
          if (!entry) return o;
          if (o.status === entry.target) {
            pending.delete(o.id);
            return o;
          }
          if (entry.target !== "delivered") {
            return { ...o, status: entry.target };
          }
          return o;
        })
        .filter((o) => pending.get(o.id)?.target !== "delivered");
      setOrders(next);
    } catch {
      /* ignore */
    }
  }, []);

  const [manualRefreshing, setManualRefreshing] = useState(false);
  async function manualRefresh() {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    try {
      await refresh();
    } finally {
      // Tiny floor so the spin animation is visible — otherwise a sub-100ms
      // refresh looks like the button didn't do anything.
      setTimeout(() => setManualRefreshing(false), 350);
    }
  }

  // SSE subscription to merchant tenant channel. The native EventSource
  // auto-reconnect handles transient network blips, but a 5xx from the
  // server (Vercel function timeout, deploy mid-stream) closes the
  // connection permanently — so we re-open it with backoff. The
  // visibilitychange listener also re-opens + immediately refreshes
  // when the tab returns from background (mobile Safari kills the
  // EventSource when the tab isn't focused).
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    let cancelled = false;
    let backoffMs = 1000;
    let reconnectTimer: number | null = null;

    function open() {
      if (cancelled) return;
      const es = new EventSource("/api/v1/realtime/merchant");
      esRef.current = es;
      es.addEventListener("open", () => {
        backoffMs = 1000;
      });
      es.addEventListener("order.created", () => {
        try {
          window.dispatchEvent(new Event("qf:new-order"));
        } catch {
          /* ignore */
        }
        void refresh();
      });
      es.addEventListener("order.status_changed", () => void refresh());
      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (cancelled) return;
        if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(open, backoffMs);
        backoffMs = Math.min(backoffMs * 2, 30_000);
        // Always pull a fresh snapshot when we're disconnected so the
        // merchant doesn't stare at a stale board while we back off.
        void refresh();
      };
    }

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      void refresh();
      if (!esRef.current || esRef.current.readyState === EventSource.CLOSED) {
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
      esRef.current?.close();
      esRef.current = null;
    };
  }, [refresh]);

  async function advance(orderId: string, to: Status | "delivered", courierId?: string) {
    pendingAdvancesRef.current.set(orderId, {
      target: to,
      expiresAt: Date.now() + 3000,
    });
    setOrders((prev) =>
      prev
        .map((o) => (o.id === orderId ? { ...o, status: to === "delivered" ? "out_for_delivery" : (to as Status) } : o))
        .filter((o) => to !== "delivered" || o.id !== orderId),
    );
    try {
      const res = await fetch(`/api/v1/merchant/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to, ...(courierId ? { courier_id: courierId } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "עדכון הסטטוס נכשל");
        pendingAdvancesRef.current.delete(orderId);
        await refresh();
      }
    } catch {
      pushToast("err", "אין חיבור לשרת — מנסה לסנכרן");
      pendingAdvancesRef.current.delete(orderId);
      await refresh();
    }
  }

  function handleAdvance(orderId: string, to: Status | "delivered") {
    if (to === "out_for_delivery") {
      const o = orders.find((x) => x.id === orderId);
      if (o?.method === "pickup") {
        void advance(orderId, "delivered");
        return;
      }
      setAssignFor({ orderId, orderNumber: o?.number ?? "" });
      return;
    }
    void advance(orderId, to);
  }

  const byColumn = useMemo(() => {
    return COLUMNS.map((col) => ({
      ...col,
      orders: orders.filter((o) => col.status.includes(o.status)),
    }));
  }, [orders]);

  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  function nextStatusFor(o: OrderRow): Status | "delivered" {
    const col = COLUMNS.find((c) => c.status.includes(o.status));
    if (!col) return o.status;
    if (o.status === "out_for_delivery") return "delivered";
    return col.next;
  }

  const totalActive = orders.length;

  return (
    <div className="space-y-4 lg:space-y-5">
      <NewOrderChime />
      <PageHeader
        chip="תפעול"
        title="הזמנות חיות"
        subtitle={`${totalActive} הזמנות פעילות · עדכון אוטומטי`}
        actions={
          <>
            <button
              type="button"
              onClick={manualRefresh}
              disabled={manualRefreshing}
              title="רענון ידני של ההזמנות מהשרת"
              aria-label="רענון ידני"
              className="inline-flex w-10 h-10 items-center justify-center rounded-xl bg-white border-2 border-black text-black shadow-[0_2px_0_#000] hover:bg-black/5 disabled:opacity-60"
            >
              <IcoRefresh
                s={16}
                className={manualRefreshing ? "animate-spin" : ""}
              />
            </button>
            <Link
              href="/dashboard/orders/history"
              className="hidden sm:inline-flex px-3.5 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm items-center gap-2 shadow-[0_2px_0_#000] hover:bg-black/5"
            >
              היסטוריה
            </Link>
            <button
              type="button"
              className="hidden sm:inline-flex px-3.5 py-2 rounded-xl bg-white border-2 border-black text-black font-bold text-sm items-center gap-2 shadow-[0_2px_0_#000] hover:bg-black/5"
              onClick={() => window.print()}
            >
              <IcoPrinter s={16} /> הדפסת תור
            </button>
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90"
            >
              + הזמנה ידנית
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {byColumn.map((col) => (
          <Column
            key={col.title}
            {...col}
            now={now}
            onAdvance={handleAdvance}
            onSelect={(id) => setDrawerOrderId(id)}
          />
        ))}
      </div>

      {drawerOrderId && (
        <OrderDrawer
          orderId={drawerOrderId}
          onClose={() => setDrawerOrderId(null)}
          onAdvance={(id) => {
            const o = orders.find((x) => x.id === id);
            if (o) {
              handleAdvance(id, nextStatusFor(o));
              setDrawerOrderId(null);
            }
          }}
        />
      )}

      {manualOpen && <ManualOrderModal onClose={() => setManualOpen(false)} />}

      {assignFor && (
        <AssignCourierModal
          orderNumber={assignFor.orderNumber}
          onAssign={async (courierId) => {
            await advance(assignFor.orderId, "out_for_delivery", courierId);
          }}
          onClose={() => setAssignFor(null)}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function Column({
  title,
  subtitle,
  orders,
  next,
  actionLabel,
  now,
  onAdvance,
  onSelect,
}: {
  title: string;
  subtitle: string;
  orders: OrderRow[];
  status: Status[];
  next: Status;
  actionLabel: string;
  now: number | null;
  onAdvance: (id: string, to: Status | "delivered") => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="bg-white rounded-2xl border border-qf-line-dash p-3 min-h-[40vh] md:min-h-[60vh] flex flex-col">
      <header className="px-2 pt-1 pb-2 flex items-center justify-between">
        <div>
          <div className="font-semibold flex items-center gap-2">
            {title}
            <span className="text-xs bg-qf-line-soft px-1.5 py-0.5 rounded-md text-qf-ink2">
              {orders.length}
            </span>
          </div>
          <div className="text-xs text-qf-mute">{subtitle}</div>
        </div>
      </header>
      <div className="flex-1 space-y-2.5">
        {orders.length === 0 ? (
          <div className="border-2 border-dashed border-qf-line-dash rounded-xl h-32 grid place-items-center text-sm text-qf-mute">
            אין הזמנות בעמודה הזו
          </div>
        ) : (
          orders.map((o) => (
            <Card
              key={o.id}
              order={o}
              next={next}
              // Pickup orders skip the "out for delivery" step — when
              // advancing them from "ready", the action is "hand to
              // customer", not "hand to courier". And a `confirmed`
              // card lives in the "new" column but doesn't need
              // approval (Grow already approved); merchant just kicks
              // off the kitchen.
              actionLabel={
                o.status === "ready" && o.method === "pickup"
                  ? "נמסר ללקוח"
                  : o.status === "confirmed"
                    ? "התחל הכנה"
                    : o.status === "pending" && o.paymentMethod === "cash"
                      ? "מזומן התקבל"
                      : actionLabel
              }
              now={now}
              onAdvance={onAdvance}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </section>
  );
}

function Card({
  order,
  next,
  actionLabel,
  now,
  onAdvance,
  onSelect,
}: {
  order: OrderRow;
  next: Status;
  actionLabel: string;
  /** `null` until the client-side timer has ticked at least once — keeps SSR and first paint identical. */
  now: number | null;
  onAdvance: (id: string, to: Status | "delivered") => void;
  onSelect: (id: string) => void;
}) {
  const elapsedMin =
    now != null ? Math.floor((now - new Date(order.createdAt).getTime()) / 60_000) : null;
  const isLate =
    elapsedMin != null && elapsedMin > SLA_MINUTES_BEFORE_LATE && order.status !== "out_for_delivery";

  const target: Status | "delivered" = order.status === "out_for_delivery" ? "delivered" : next;

  return (
    <article
      onClick={() => onSelect(order.id)}
      className={cn(
        "rounded-xl border bg-white p-3 space-y-2.5 transition cursor-pointer hover:border-(--qf-primary)",
        isLate ? "border-qf-tomato/60 ring-1 ring-qf-tomato/30" : "border-qf-line-dash",
      )}
    >
      <header className="flex items-center justify-between">
        <div className="font-mono font-semibold text-sm">{order.number}</div>
        <StatusChip
          status={order.status}
          paymentStatus={order.paymentStatus}
          late={isLate}
        />
      </header>

      <div className="text-sm font-medium">{order.customerName}</div>
      <div className="text-xs text-qf-mute flex items-center gap-1.5">
        <IcoClock c="#7c8a82" s={12} />
        {elapsedMin != null && <>לפני {elapsedMin} דק&apos; · </>}
        {order.method === "delivery" ? "משלוח" : "איסוף"}
      </div>

      <ul className="text-xs space-y-1">
        {order.items.slice(0, 3).map((it) => {
          const opts = renderItemOptions(it.options);
          return (
            <li key={it.id} className="leading-tight">
              <div className="flex gap-1.5">
                <span className="font-medium tnum shrink-0">{it.quantity}×</span>
                <span className="text-qf-ink2">
                  {it.name}
                  {it.size ? ` · ${it.size}` : ""}
                </span>
              </div>
              {opts && (
                <div className="ps-5 text-[11px] text-qf-mute leading-snug">{opts}</div>
              )}
              {it.notes && (
                <div className="ps-5 text-[11px] text-qf-tomato leading-snug">
                  הערה: {it.notes}
                </div>
              )}
            </li>
          );
        })}
        {order.items.length > 3 && (
          <li className="text-qf-mute">+ {order.items.length - 3} פריטים נוספים</li>
        )}
      </ul>

      {order.customerNotes && (
        <div className="text-xs bg-qf-yolk-soft border border-qf-yolk/40 rounded-lg px-2 py-1.5 text-qf-ink2">
          {order.customerNotes}
        </div>
      )}

      <footer className="flex items-center justify-between pt-1 gap-2">
        <div className="text-sm font-semibold tnum">{formatPrice(order.total)}</div>
        <div className="flex items-center gap-1.5">
          {PREVIOUS_STATUS[order.status] && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const prev = PREVIOUS_STATUS[order.status];
                if (prev) onAdvance(order.id, prev);
              }}
              title="חזרה שלב אחורה"
              aria-label="חזרה שלב אחורה"
              className="inline-flex w-8 h-8 items-center justify-center rounded-lg border border-qf-line-dash text-qf-mute hover:text-qf-ink hover:border-qf-ink/40 transition"
            >
              <IcoUndo s={14} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdvance(order.id, target);
            }}
            className="px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xs font-medium"
          >
            {actionLabel}
          </button>
        </div>
      </footer>

      {order.customerPhone && (
        <a
          href={`tel:${order.customerPhone}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-xs text-qf-mute hover:text-qf-ink"
          dir="ltr"
        >
          <IcoPhone c="#7c8a82" s={12} /> {order.customerPhone}
        </a>
      )}
    </article>
  );
}

function StatusChip({
  status,
  paymentStatus,
  late,
}: {
  status: Status;
  paymentStatus: PaymentStatus;
  late: boolean;
}) {
  if (late) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-qf-tomato-soft text-qf-tomato">
        <IcoFlame c="#c2421f" s={10} />
        חורג
      </span>
    );
  }
  const labels: Record<Status, string> = {
    pending: "ממתינה",
    confirmed: "אושרה",
    preparing: "בהכנה",
    in_oven: "בתנור",
    ready: "מוכנה",
    out_for_delivery: "בדרך",
  };
  // Once the customer actually paid (card via Grow callback, or
  // cash collected at delivery), "שולמה" is what the merchant cares
  // about — clearer than the generic "אושרה". Pending payments
  // (cash before delivery, or unsettled card) keep the lifecycle
  // label so we don't accidentally claim money we don't have.
  const label = paymentStatus === "paid" ? "שולמה" : labels[status];
  return (
    <span className="inline-block text-[10px] font-medium px-2 py-1 rounded-md bg-qf-green-soft text-qf-green-deep">
      {label}
    </span>
  );
}
