"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IcoClock, IcoPhone, IcoPrinter, IcoFlame } from "@/components/shared/Icons";
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

interface OrderRow {
  id: string;
  number: string;
  status: Status;
  method: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  customerNotes: string | null;
  total: number;
  createdAt: string;
  items: Array<{ id: string; name: string; quantity: number; size: string | null }>;
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
    subtitle: "ממתינות לאישור",
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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/merchant/orders?status=active", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const next: OrderRow[] = (data.orders as Array<Record<string, unknown>>).map((o) => ({
        id: o.id as string,
        number: o.number as string,
        status: o.status as Status,
        method: o.method as "delivery" | "pickup",
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
        })),
      }));
      setOrders(next);
    } catch {
      /* ignore */
    }
  }, []);

  // SSE subscription to merchant tenant channel
  useEffect(() => {
    const es = new EventSource("/api/v1/realtime/merchant");
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
      // EventSource auto-reconnects; nothing to do
    };
    return () => {
      es.close();
    };
  }, [refresh]);

  async function advance(orderId: string, to: Status | "delivered", courierId?: string) {
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
        await refresh();
      }
    } catch {
      pushToast("err", "אין חיבור לשרת — מנסה לסנכרן");
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
              // customer", not "hand to courier".
              actionLabel={
                o.status === "ready" && o.method === "pickup"
                  ? "נמסר ללקוח"
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
        <StatusChip status={order.status} late={isLate} />
      </header>

      <div className="text-sm font-medium">{order.customerName}</div>
      <div className="text-xs text-qf-mute flex items-center gap-1.5">
        <IcoClock c="#7c8a82" s={12} />
        {elapsedMin != null && <>לפני {elapsedMin} דק&apos; · </>}
        {order.method === "delivery" ? "משלוח" : "איסוף"}
      </div>

      <ul className="text-xs space-y-0.5">
        {order.items.slice(0, 3).map((it) => (
          <li key={it.id} className="flex gap-1.5">
            <span className="font-medium tnum">{it.quantity}×</span>
            <span className="text-qf-ink2 truncate">
              {it.name}
              {it.size ? ` · ${it.size}` : ""}
            </span>
          </li>
        ))}
        {order.items.length > 3 && (
          <li className="text-qf-mute">+ {order.items.length - 3} פריטים נוספים</li>
        )}
      </ul>

      {order.customerNotes && (
        <div className="text-xs bg-qf-yolk-soft border border-qf-yolk/40 rounded-lg px-2 py-1.5 text-qf-ink2">
          {order.customerNotes}
        </div>
      )}

      <footer className="flex items-center justify-between pt-1">
        <div className="text-sm font-semibold tnum">{formatPrice(order.total)}</div>
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

function StatusChip({ status, late }: { status: Status; late: boolean }) {
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
  return (
    <span className="inline-block text-[10px] font-medium px-2 py-1 rounded-md bg-qf-green-soft text-qf-green-deep">
      {labels[status]}
    </span>
  );
}
