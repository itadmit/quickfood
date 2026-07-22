"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IcoClock, IcoPrinter, IcoFlame, IcoRefresh, IcoUndo, IcoClose, IcoBell, IcoBellOff } from "@/components/shared/Icons";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { formatPrice, formatElapsedMinutes } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  consumePassPrntResult,
  formatSelectedOptions,
  printReceipt,
  printReceiptIframe,
  buildReceiptHtml,
  RECEIPT_PRINTER_LABEL,
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptOrder,
  type ReceiptPrinterType,
  type ReceiptSettings,
} from "@/lib/receipt-print";
import { OrderDrawer } from "@/components/merchant/OrderDrawer";
import { ManualOrderModal } from "@/components/merchant/ManualOrderModal";
import { AssignCourierModal } from "@/components/merchant/AssignCourierModal";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { NewOrderChime } from "@/components/merchant/NewOrderChime";

declare global {
  interface Window {
    /** Injected by the QuickFood desktop app (Electron preload) to print a
     *  receipt HTML silently on the OS default printer. Absent in a browser. */
    qfNativePrint?: (html: string) => void | Promise<void>;
  }
}

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
    // The column holds both pending (need merchant approval - usually
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
    next: "out_for_delivery", // delivered - handled separately
    actionLabel: "סמן כנמסר",
  },
];

const SLA_MINUTES_BEFORE_LATE = 15;

// A "new" order (pending / confirmed - the first column) that the merchant
// hasn't picked up yet keeps nagging: every NUDGE_INTERVAL_MS the card wiggles
// side-to-side and the chime replays, until they either advance it out of the
// column or tap "turn off nudge". Dismissals live per-device in localStorage so
// a tab refresh doesn't restart the nagging on already-seen orders.
const NUDGE_INTERVAL_MS = 120_000;
const NUDGE_SHAKE_MS = 900;
const NUDGE_DISMISSED_KEY = "qf_merchant_nudge_dismissed";
const NEW_COLUMN_STATUSES: Status[] = ["pending", "confirmed"];

function loadDismissedNudges(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(NUDGE_DISMISSED_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissedNudges(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NUDGE_DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

// Reverse map for the "חזרה שלב" undo button on each card. Only states
// past the "new orders" column have a meaningful previous - going from
// confirmed back to pending just un-accepts the order, which the merchant
// can do via cancel + recreate; not worth a one-tap arrow that clutters
// every new card. Past out_for_delivery stays locked too - courier
// wallet/route is tied to it, use refund/cancel instead.
const PREVIOUS_STATUS: Partial<Record<Status, Status>> = {
  preparing: "confirmed",
  in_oven: "preparing",
  ready: "preparing",
};

export function OrdersKanban({
  initial,
  receiptPrinter = "airprint",
  receiptSettings = DEFAULT_RECEIPT_SETTINGS,
}: {
  initial: OrderRow[];
  receiptPrinter?: ReceiptPrinterType;
  receiptSettings?: ReceiptSettings;
}) {
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

  // Per-card nudge state. `dismissedNudges` is hydrated from localStorage after
  // mount (empty on the server so SSR and first paint agree). `shakingIds` holds
  // the ids currently mid-wiggle - added on each nudge tick, cleared once the
  // animation finishes.
  const [dismissedNudges, setDismissedNudges] = useState<Set<string>>(() => new Set());
  const [shakingIds, setShakingIds] = useState<Set<string>>(() => new Set());
  const [printingIds, setPrintingIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setDismissedNudges(loadDismissedNudges());
  }, []);

  // The interval is set up once; it reads the latest orders/dismissals through
  // refs so the 2-minute clock isn't reset on every refresh() or 30s now-tick.
  const ordersRef = useRef(orders);
  const dismissedRef = useRef(dismissedNudges);
  const shakeTimerRef = useRef<number | null>(null);
  useEffect(() => {
    ordersRef.current = orders;
    dismissedRef.current = dismissedNudges;
  }, [orders, dismissedNudges]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const dueIds = ordersRef.current
        .filter((o) => NEW_COLUMN_STATUSES.includes(o.status) && !dismissedRef.current.has(o.id))
        .map((o) => o.id);
      if (dueIds.length === 0) return;
      setShakingIds(new Set(dueIds));
      // Replay the selected chime - NewOrderChime listens on this and honours
      // the per-device mute toggle, so a muted merchant gets the wiggle only.
      try {
        window.dispatchEvent(new Event("qf:new-order"));
      } catch {
        /* ignore */
      }
      if (shakeTimerRef.current != null) window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = window.setTimeout(() => setShakingIds(new Set()), NUDGE_SHAKE_MS);
    }, NUDGE_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      if (shakeTimerRef.current != null) window.clearTimeout(shakeTimerRef.current);
    };
  }, []);

  // Drop dismissals for orders that have left the active board so localStorage
  // doesn't accumulate stale ids forever.
  useEffect(() => {
    setDismissedNudges((prev) => {
      if (prev.size === 0) return prev;
      const activeIds = new Set(orders.map((o) => o.id));
      let changed = false;
      const next = new Set<string>();
      for (const dismissedId of prev) {
        if (activeIds.has(dismissedId)) next.add(dismissedId);
        else changed = true;
      }
      if (!changed) return prev;
      saveDismissedNudges(next);
      return next;
    });
  }, [orders]);

  const toggleNudge = useCallback((orderId: string) => {
    setDismissedNudges((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      saveDismissedNudges(next);
      return next;
    });
    setShakingIds((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  }, []);

  // Track orders the user just optimistically advanced. When the SSE
  // fires "order.status_changed" we refresh - but the new list often
  // hasn't yet caught the PATCH we just sent (write-then-read on Neon
  // can lag a few hundred ms), so without this the card visibly jumps
  // back to the old column then forward again. expiresAt acts as a
  // fallback in case the PATCH silently fails: after 3s the optimistic
  // mark is dropped and the next refresh shows the real server state.
  const pendingAdvancesRef =
    useRef<Map<string, { target: Status | "delivered"; expiresAt: number }>>(new Map());

  // Every order id we've ever shown. The new-order chime keys off this:
  // any id in a fresh snapshot that we've never seen rings the bell - so
  // the sound fires whether the order arrived over the live SSE event or
  // got picked up by a refresh() (reconnect, tab refocus, SSE gap). Seeded
  // from the server-rendered initial list so existing orders stay silent.
  const seenIdsRef = useRef<Set<string>>(new Set(initial.map((o) => o.id)));

  // Auto-print reads settings/printer via refs so the useCallback([]) refresh
  // loop never prints with a stale config after the merchant changes settings.
  const receiptSettingsRef = useRef(receiptSettings);
  const receiptPrinterRef = useRef(receiptPrinter);
  useEffect(() => {
    receiptSettingsRef.current = receiptSettings;
    receiptPrinterRef.current = receiptPrinter;
  }, [receiptSettings, receiptPrinter]);

  // Silently print a freshly-arrived order. Prefers the QuickFood desktop app's
  // native bridge (prints on the OS default printer even when minimized);
  // otherwise the browser silent-print path (airprint family + --kiosk-printing).
  const autoPrintOrder = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/v1/customer/orders/${orderId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const detail = (data.order as ReceiptOrder | null) ?? null;
      if (!detail) return;
      const settings = receiptSettingsRef.current;
      const native = typeof window !== "undefined" ? window.qfNativePrint : undefined;
      if (typeof native === "function") {
        await native(buildReceiptHtml(detail, settings));
      } else if (receiptPrinterRef.current === "airprint") {
        printReceiptIframe(detail, settings);
      }
      // Mobile-app printer families (star / epson / escpos) can't silently
      // auto-print from the board - the manual print button covers those.
    } catch {
      /* best-effort - never block the board on a print failure */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      // cache:"no-store" so a service worker or browser intermediate
      // never serves a stale active-orders list that still includes a
      // card the merchant just hid via the X icon.
      const res = await fetch("/api/v1/merchant/orders?status=active", {
        credentials: "include",
        cache: "no-store",
      });
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
          (o.customer_name as string | null) ||
          (o.customer as { name?: string } | null)?.name ||
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
      // Ring the chime for any order we've never seen before, regardless of
      // how it reached us. SSE order.created and a reconnect refresh() both
      // funnel through here, so this is the single source of truth - the SSE
      // listener no longer dispatches the event itself (would double-ring).
      const newIds = fresh.filter((o) => !seenIdsRef.current.has(o.id)).map((o) => o.id);
      for (const o of fresh) seenIdsRef.current.add(o.id);
      if (newIds.length > 0) {
        try {
          window.dispatchEvent(new Event("qf:new-order"));
        } catch {
          /* ignore */
        }
      }
      // Auto-print each genuinely-new order (seenIdsRef is seeded with the
      // server-rendered list, so pre-existing orders never print).
      if (receiptSettingsRef.current.autoPrintOnNew && newIds.length > 0) {
        for (const id of newIds) void autoPrintOrder(id);
      }

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
      // Tiny floor so the spin animation is visible - otherwise a sub-100ms
      // refresh looks like the button didn't do anything.
      setTimeout(() => setManualRefreshing(false), 350);
    }
  }

  // SSE subscription to merchant tenant channel. The native EventSource
  // auto-reconnect handles transient network blips, but a 5xx from the
  // server (Vercel function timeout, deploy mid-stream) closes the
  // connection permanently - so we re-open it with backoff. The
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
        // refresh() detects the unseen id and rings the chime itself - see
        // seenIdsRef. Dispatching here too would double-ring.
        void refresh();
      });
      es.addEventListener("order.status_changed", () => void refresh());
      // Refund/cancel writes an orderEvent of type "refunded" (not
      // status_changed), so without this listener a cancelled order would linger
      // on the board until the next reconnect/refocus refresh.
      es.addEventListener("order.refunded", () => void refresh());
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
      pushToast("err", "אין חיבור לשרת - מנסה לסנכרן");
      pendingAdvancesRef.current.delete(orderId);
      await refresh();
    }
  }

  async function hideFromKanban(orderId: string) {
    const ok = window.confirm(
      "להסיר את ההזמנה מלוח ההזמנות החי? היא תישמר בהיסטוריה ואפשר לשחזר משם.",
    );
    if (!ok) return;
    // Optimistic: yank the card from local state before the server
    // confirms. If the API errors we re-fetch and the card reappears.
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      const res = await fetch(
        `/api/v1/merchant/orders/${orderId}/kanban-hide`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "ההסרה נכשלה");
        await refresh();
        return;
      }
      pushToast("ok", "ההזמנה הוסרה מלוח ההזמנות החי");
    } catch {
      pushToast("err", "אין חיבור לשרת - מנסה לסנכרן");
      await refresh();
    }
  }

  async function printOrder(orderId: string) {
    if (printingIds.has(orderId)) return;
    setPrintingIds((prev) => new Set(prev).add(orderId));
    try {
      // The card only carries a slim OrderRow; the receipt needs the full
      // breakdown (fees, address, options), so pull the same detail the
      // drawer uses, then hand it to the configured printer.
      const res = await fetch(`/api/v1/customer/orders/${orderId}`, { cache: "no-store" });
      if (!res.ok) {
        pushToast("err", "טעינת ההזמנה להדפסה נכשלה");
        return;
      }
      const data = await res.json();
      const detail = (data.order as ReceiptOrder | null) ?? null;
      if (!detail) {
        pushToast("err", "ההזמנה לא נמצאה");
        return;
      }
      if (receiptPrinter === "airprint") {
        printReceiptIframe(detail, receiptSettings);
      } else {
        printReceipt(
          detail,
          receiptPrinter,
          () =>
            pushToast(
              "err",
              "אפליקציית ההדפסה לא נמצאה במכשיר. הוראות התקנה: הגדרות ← מדפסת קבלות.",
            ),
          receiptSettings,
        );
      }
    } catch {
      pushToast("err", "אין חיבור לשרת - ההדפסה נכשלה");
    } finally {
      setPrintingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
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

  useEffect(() => {
    const result = consumePassPrntResult();
    if (!result) return;
    if (result.ok) pushToast("ok", "הקבלה הודפסה");
    else pushToast("err", `ההדפסה נכשלה${result.message ? `: ${result.message}` : ""}`);
  }, []);

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
            shakingIds={shakingIds}
            dismissedNudges={dismissedNudges}
            printingIds={printingIds}
            printerLabel={RECEIPT_PRINTER_LABEL[receiptPrinter]}
            onToggleNudge={toggleNudge}
            onAdvance={handleAdvance}
            onSelect={(id) => setDrawerOrderId(id)}
            onHide={hideFromKanban}
            onPrint={printOrder}
          />
        ))}
      </div>

      {drawerOrderId && (
        <OrderDrawer
          orderId={drawerOrderId}
          receiptPrinter={receiptPrinter}
          receiptSettings={receiptSettings}
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
  shakingIds,
  dismissedNudges,
  printingIds,
  printerLabel,
  onToggleNudge,
  onAdvance,
  onSelect,
  onHide,
  onPrint,
}: {
  title: string;
  subtitle: string;
  orders: OrderRow[];
  status: Status[];
  next: Status;
  actionLabel: string;
  now: number | null;
  shakingIds: Set<string>;
  dismissedNudges: Set<string>;
  printingIds: Set<string>;
  printerLabel: string;
  onToggleNudge: (id: string) => void;
  onAdvance: (id: string, to: Status | "delivered") => void;
  onSelect: (id: string) => void;
  onHide: (id: string) => void;
  onPrint: (id: string) => void;
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
              // Pickup orders skip the "out for delivery" step - when
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
                    : o.status === "pending"
                      ? "אשר הזמנה"
                      : actionLabel
              }
              now={now}
              shaking={shakingIds.has(o.id)}
              nudgeDismissed={dismissedNudges.has(o.id)}
              printing={printingIds.has(o.id)}
              printerLabel={printerLabel}
              onToggleNudge={onToggleNudge}
              onAdvance={onAdvance}
              onSelect={onSelect}
              onHide={onHide}
              onPrint={onPrint}
            />
          ))
        )}
      </div>
    </section>
  );
}

// Payment-at-a-glance pill next to the order total. Cash is highlighted amber
// (collect on hand-off); paid orders read green so the merchant instantly sees
// the money is already in.
function PaymentTag({ method, status }: { method: string; status: PaymentStatus }) {
  const paid = status === "paid";
  const isCash = method === "cash";
  const label = paid
    ? isCash
      ? "שולם · מזומן"
      : "שולם · אשראי"
    : isCash
      ? "מזומן"
      : "אשראי";
  return (
    <span
      className={cn(
        "text-[10px] font-black px-1.5 py-0.5 rounded-md border whitespace-nowrap shrink-0",
        paid
          ? "bg-qf-green-soft text-qf-green-deep border-qf-green-deep/30"
          : isCash
            ? "bg-qf-yolk-soft text-qf-ink2 border-qf-yolk/60"
            : "bg-qf-line-soft text-qf-ink2 border-qf-line",
      )}
    >
      {label}
    </span>
  );
}

function Card({
  order,
  next,
  actionLabel,
  now,
  shaking,
  nudgeDismissed,
  printing,
  printerLabel,
  onToggleNudge,
  onAdvance,
  onSelect,
  onHide,
  onPrint,
}: {
  order: OrderRow;
  next: Status;
  actionLabel: string;
  /** `null` until the client-side timer has ticked at least once - keeps SSR and first paint identical. */
  now: number | null;
  shaking: boolean;
  nudgeDismissed: boolean;
  printing: boolean;
  printerLabel: string;
  onToggleNudge: (id: string) => void;
  onAdvance: (id: string, to: Status | "delivered") => void;
  onSelect: (id: string) => void;
  onHide: (id: string) => void;
  onPrint: (id: string) => void;
}) {
  const nudgeable = NEW_COLUMN_STATUSES.includes(order.status);
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
        shaking && "animate-qf-nudge-shake",
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="font-mono font-semibold text-sm">{order.number}</div>
        <div className="flex items-center gap-1.5">
          <StatusChip
            status={order.status}
            paymentStatus={order.paymentStatus}
            late={isLate}
          />
          {nudgeable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleNudge(order.id);
              }}
              title={nudgeDismissed ? "נודניק כבוי - לחץ להחזרת התזכורת" : "כבה נודניק - הפסק תזכורת לכרטיס הזה"}
              aria-label={nudgeDismissed ? "הפעל נודניק" : "כבה נודניק"}
              className={cn(
                "w-6 h-6 grid place-items-center rounded-md transition",
                nudgeDismissed
                  ? "text-qf-mute hover:text-qf-ink hover:bg-qf-line-soft"
                  : "text-qf-green-deep hover:bg-qf-green-soft",
              )}
            >
              {nudgeDismissed ? (
                <IcoBellOff s={13} c="currentColor" />
              ) : (
                <IcoBell s={13} c="currentColor" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHide(order.id);
            }}
            title="הסר מלוח ההזמנות החי"
            aria-label="הסר מלוח ההזמנות החי"
            className="w-6 h-6 grid place-items-center rounded-md text-qf-mute hover:text-qf-tomato hover:bg-qf-tomato-soft transition"
          >
            <IcoClose s={12} c="currentColor" />
          </button>
        </div>
      </header>

      <div className="text-sm font-medium">{order.customerName}</div>
      <div className="text-xs text-qf-mute flex items-center gap-1.5">
        <IcoClock c="#7c8a82" s={12} />
        {elapsedMin != null && (
          <>{elapsedMin === 0 ? "עכשיו" : `לפני ${formatElapsedMinutes(elapsedMin)}`} · </>
        )}
        {order.method === "delivery" ? "משלוח" : "איסוף"}
      </div>

      <ul className="text-xs space-y-1">
        {order.items.slice(0, 3).map((it) => {
          const opts = formatSelectedOptions(it.options);
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

      <footer className="flex flex-wrap items-center gap-x-2 gap-y-2 pt-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold tnum shrink-0">{formatPrice(order.total)}</span>
          <PaymentTag method={order.paymentMethod} status={order.paymentStatus} />
        </div>
        <div className="flex items-center gap-1.5 ms-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrint(order.id);
            }}
            disabled={printing}
            title={`הדפסת קבלה · ${printerLabel}`}
            aria-label="הדפסת קבלה"
            className={cn(
              "inline-flex w-8 h-8 items-center justify-center rounded-lg border border-qf-line-dash text-qf-mute hover:text-qf-ink hover:border-qf-ink/40 transition disabled:opacity-50",
              printing && "animate-qf-pulse",
            )}
          >
            <IcoPrinter s={14} />
          </button>
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
  // about - clearer than the generic "אושרה". Pending payments
  // (cash before delivery, or unsettled card) keep the lifecycle
  // label so we don't accidentally claim money we don't have.
  const label = paymentStatus === "paid" ? "שולמה" : labels[status];
  return (
    <span className="inline-block text-[10px] font-medium px-2 py-1 rounded-md bg-qf-green-soft text-qf-green-deep">
      {label}
    </span>
  );
}
