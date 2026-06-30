"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { OrderStatusBadgeV2 } from "@/components/merchant/OrderStatusBadgeV2";
import { OrderDrawer } from "@/components/merchant/OrderDrawer";
import { AssignCourierModal } from "@/components/merchant/AssignCourierModal";
import {
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptPrinterType,
  type ReceiptSettings,
} from "@/lib/receipt-print";

type Status =
  | "pending"
  | "confirmed"
  | "preparing"
  | "in_oven"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";

type Method = "delivery" | "pickup";

interface OrderRow {
  id: string;
  number: string;
  status: Status;
  method: Method;
  customer_name: string | null;
  customer_phone: string | null;
  customer: { name: string | null; phone: string | null } | null;
  total: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  has_review: boolean;
  review_reminder_sent: boolean;
  kanban_hidden_at: string | null;
}

interface Meta {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "כל הסטטוסים" },
  { value: "active", label: "פעילות (לא נמסרו)" },
  { value: "delivered", label: "נמסרו" },
  { value: "cancelled", label: "בוטלו" },
  { value: "refunded", label: "הוחזרו" },
  { value: "pending", label: "ממתינות" },
  { value: "confirmed", label: "אושרו" },
  { value: "preparing", label: "בהכנה" },
  { value: "ready", label: "מוכנות" },
  { value: "out_for_delivery", label: "במשלוח" },
];

const METHOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "הכל" },
  { value: "delivery", label: "משלוח" },
  { value: "pickup", label: "איסוף" },
];

// Payment filter. Default "settled" hides abandoned card/wallet carts
// (never-paid orders the customer dropped at the payment screen) while
// keeping cash orders, which legitimately sit at "ממתין" until collected.
const PAYMENT_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "settled", label: "ללא נטושות" },
  { value: "", label: "כל התשלומים" },
  { value: "paid", label: "שולמו" },
  { value: "pending", label: "ממתין תשלום" },
  { value: "refunded", label: "הוחזרו" },
  { value: "failed", label: "נכשלו" },
];

const PAYMENT_LABEL: Record<string, string> = {
  cash: "מזומן",
  card: "כרטיס",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  bit: "Bit",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "ממתין",
  paid: "שולם",
  failed: "נכשל",
  refunded: "הוחזר",
};

// Pending means different things by method: a cash order is collected in
// person (so "לגבייה"), while a pending card order simply hasn't been
// captured yet. Spell that out so the column isn't ambiguous.
function paymentStatusText(method: string, status: string): string {
  if (status === "pending") return method === "cash" ? "לגבייה" : "ממתין";
  return PAYMENT_STATUS_LABEL[status] ?? status;
}

function paymentStatusTitle(method: string, status: string): string {
  if (status === "pending") {
    return method === "cash"
      ? "תשלום במזומן — ייגבה מהלקוח בעת המסירה/האיסוף"
      : "תשלום בכרטיס שטרם נגבה (בתהליך, או עגלה שננטשה לפני התשלום)";
  }
  if (status === "paid") return "התשלום נגבה בפועל";
  if (status === "refunded") return "התשלום זוכה ללקוח";
  if (status === "failed") return "התשלום נכשל";
  return "";
}

// Plain-language tooltip for each lifecycle status (the badge itself is
// short; this spells it out on hover).
const STATUS_HELP: Record<string, string> = {
  pending: "ממתינה לאישור המסעדה",
  confirmed: "ההזמנה אושרה",
  preparing: "בהכנה",
  in_oven: "בתנור",
  ready: "מוכנה לאיסוף/משלוח",
  out_for_delivery: "יצאה למשלוח",
  delivered: "נמסרה ללקוח",
  cancelled: "בוטלה",
  refunded: "הוחזרה / זוכתה",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

export function OrdersHistoryView({
  receiptPrinter = "airprint",
  receiptSettings = DEFAULT_RECEIPT_SETTINGS,
}: {
  receiptPrinter?: ReceiptPrinterType;
  receiptSettings?: ReceiptSettings;
}) {
  const [status, setStatus] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [payment, setPayment] = useState<string>("settled");
  const [from, setFrom] = useState<string>(isoDaysAgo(30));
  const [to, setTo] = useState<string>(todayIso());
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [perPage] = useState<number>(30);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, per_page: perPage, total_pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Order ids currently mid-POST + a short-lived per-id status message
  // for the row chip - fades after 4s. Keeps the button localized to
  // the row the merchant clicked without blocking the rest of the list.
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [rowStatus, setRowStatus] = useState<
    Record<string, { tone: "ok" | "err"; message: string }>
  >({});
  // Order detail drawer + the courier-assignment modal it triggers when a
  // delivery order is handed off. reloadKey lets an action (advance) force
  // the list to re-fetch so the row reflects the new status.
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<{ orderId: string; orderNumber: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  function refresh() {
    setReloadKey((k) => k + 1);
  }

  function nextStatusFor(o: OrderRow): Status | "delivered" {
    if (o.status === "pending" || o.status === "confirmed") return "preparing";
    if (o.status === "preparing" || o.status === "in_oven") return "ready";
    if (o.status === "ready") return "out_for_delivery";
    if (o.status === "out_for_delivery") return "delivered";
    return o.status;
  }

  async function advance(orderId: string, to: Status | "delivered", courierId?: string) {
    try {
      const res = await fetch(`/api/v1/merchant/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to, ...(courierId ? { courier_id: courierId } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRowStatus((prev) => ({
          ...prev,
          [orderId]: { tone: "err", message: body?.error?.message ?? "עדכון הסטטוס נכשל" },
        }));
        return;
      }
      refresh();
    } catch {
      setRowStatus((prev) => ({
        ...prev,
        [orderId]: { tone: "err", message: "שגיאת רשת" },
      }));
    }
  }

  function handleAdvance(orderId: string) {
    const o = orders.find((x) => x.id === orderId);
    if (!o) return;
    const to = nextStatusFor(o);
    if (to === "out_for_delivery") {
      if (o.method === "pickup") {
        void advance(orderId, "delivered");
        return;
      }
      setAssignFor({ orderId, orderNumber: o.number });
      return;
    }
    void advance(orderId, to);
  }

  async function restoreToKanban(orderId: string) {
    if (sendingId) return;
    try {
      const res = await fetch(
        `/api/v1/merchant/orders/${orderId}/kanban-hide`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setRowStatus((prev) => ({
          ...prev,
          [orderId]: { tone: "err", message: "שחזור נכשל" },
        }));
        return;
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, kanban_hidden_at: null } : o,
        ),
      );
      setRowStatus((prev) => ({
        ...prev,
        [orderId]: { tone: "ok", message: "הוחזר ללוח ההזמנות החי" },
      }));
      window.setTimeout(() => {
        setRowStatus((prev) => {
          if (!prev[orderId]) return prev;
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      }, 3000);
    } catch {
      setRowStatus((prev) => ({
        ...prev,
        [orderId]: { tone: "err", message: "שגיאת רשת" },
      }));
    }
  }

  async function sendReviewNow(orderId: string) {
    if (sendingId) return;
    setSendingId(orderId);
    try {
      const res = await fetch(
        `/api/v1/merchant/orders/${orderId}/send-review-now`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.error?.message === "string"
            ? data.error.message
            : "שליחה נכשלה";
        setRowStatus((prev) => ({ ...prev, [orderId]: { tone: "err", message: msg } }));
        return;
      }
      // Optimistic flip so the button hides for this row immediately -
      // the next refresh confirms via review_reminder_sent.
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, review_reminder_sent: true } : o,
        ),
      );
      const channel: string = data?.channel ?? "sms";
      setRowStatus((prev) => ({
        ...prev,
        [orderId]: {
          tone: "ok",
          message:
            channel === "email"
              ? "נשלח במייל"
              : channel === "whatsapp"
                ? "נשלח בוואטסאפ"
                : "נשלח באסמס",
        },
      }));
    } catch {
      setRowStatus((prev) => ({
        ...prev,
        [orderId]: { tone: "err", message: "שגיאת רשת" },
      }));
    } finally {
      setSendingId(null);
      window.setTimeout(() => {
        setRowStatus((prev) => {
          if (!prev[orderId]) return prev;
          const next = { ...prev };
          delete next[orderId];
          return next;
        });
      }, 4000);
    }
  }

  // Debounce the search input so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever any filter changes.
  useEffect(() => {
    setPage(1);
  }, [status, method, payment, from, to, debouncedSearch]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (method) params.set("method", method);
    if (payment) params.set("payment", payment);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("page", String(page));
    params.set("per_page", String(perPage));

    fetch(`/api/v1/merchant/orders?${params.toString()}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(body?.error?.message ?? "שגיאה בטעינה");
        }
        return body;
      })
      .then((data) => {
        setOrders(data.orders ?? []);
        setMeta(data.meta ?? { total: 0, page: 1, per_page: perPage, total_pages: 1 });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message ?? "שגיאה");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [status, method, payment, from, to, debouncedSearch, page, perPage, reloadKey]);

  const summary = useMemo(() => {
    const totalRev = orders.reduce(
      (acc, o) => (o.status === "delivered" ? acc + o.total : acc),
      0,
    );
    return { totalRev };
  }, [orders]);

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        chip="תפעול"
        title="היסטוריית הזמנות"
        subtitle={`${meta.total} הזמנות תואמות לסינון · ${formatPrice(summary.totalRev)} הכנסה מהזמנות שנמסרו (בעמוד זה)`}
        actions={
          <Link
            href="/dashboard/orders"
            className="px-3.5 py-2 rounded-xl border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
          >
            הזמנות חיות
          </Link>
        }
      />

      <div className="bg-white rounded-2xl border border-qf-line-dash p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
        <select
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          className="px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm bg-white"
        >
          {PAYMENT_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm bg-white"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm bg-white"
        >
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש: מספר, טלפון, שם"
          className="px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
        />
      </div>

      {error && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-qf-line-dash overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-qf-line-soft text-qf-mute">
              <tr className="text-right">
                <th className="px-3 py-2 font-medium">מספר</th>
                <th className="px-3 py-2 font-medium">תאריך</th>
                <th className="px-3 py-2 font-medium">לקוח</th>
                <th className="px-3 py-2 font-medium">שיטה</th>
                <th className="px-3 py-2 font-medium">סטטוס</th>
                <th className="px-3 py-2 font-medium">תשלום</th>
                <th className="px-3 py-2 font-medium tnum text-end">סכום</th>
                <th className="px-3 py-2 font-medium">ביקורת</th>
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-qf-mute">
                    טוען...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-qf-mute">
                    אין הזמנות בטווח שבחרת
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const name =
                    o.customer?.name?.trim() ||
                    o.customer_name?.trim() ||
                    "אורח";
                  const phone = o.customer?.phone || o.customer_phone || "";
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setDrawerOrderId(o.id)}
                      className="border-t border-qf-line-soft hover:bg-qf-line-soft/30 cursor-pointer"
                      title="לחץ לצפייה בפרטי ההזמנה"
                    >
                      <td className="px-3 py-2 font-mono font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{o.number}</span>
                          {o.kanban_hidden_at && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                restoreToKanban(o.id);
                              }}
                              title="הזמנה זו הוסתרה מלוח ההזמנות החיות - לחץ כדי להחזיר אותה ללוח (זה לא החזר כספי)"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-qf-yolk-soft text-qf-ink2 text-[10px] font-medium hover:bg-qf-yolk-soft/80"
                            >
                              מוסתרת · שחזר ללוח
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-qf-mute tnum whitespace-nowrap">
                        {formatDateTime(o.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{name}</div>
                        {phone && (
                          <div className="text-xs text-qf-mute" dir="ltr">
                            {phone}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-qf-ink2">
                        {o.method === "delivery" ? "משלוח" : "איסוף"}
                      </td>
                      <td className="px-3 py-2" title={STATUS_HELP[o.status] ?? ""}>
                        <OrderStatusBadgeV2 status={o.status} />
                      </td>
                      <td
                        className="px-3 py-2 text-qf-ink2 whitespace-nowrap"
                        title={paymentStatusTitle(o.payment_method, o.payment_status)}
                      >
                        {PAYMENT_LABEL[o.payment_method] ?? o.payment_method}
                        <span className="text-xs text-qf-mute me-1">
                          · {paymentStatusText(o.payment_method, o.payment_status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 tnum font-medium text-end">
                        {formatPrice(o.total)}
                      </td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <ReviewCell
                          order={o}
                          rowStatus={rowStatus[o.id]}
                          sending={sendingId === o.id}
                          onSend={() => sendReviewNow(o.id)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta.total_pages > 1 && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-qf-line-soft text-sm">
            <div className="text-qf-mute">
              עמוד {meta.page} מתוך {meta.total_pages}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-qf-ink2 disabled:opacity-40"
              >
                הקודם
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                disabled={page >= meta.total_pages || loading}
                className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-qf-ink2 disabled:opacity-40"
              >
                הבא
              </button>
            </div>
          </div>
        )}
      </div>

      {drawerOrderId && (
        <OrderDrawer
          orderId={drawerOrderId}
          receiptPrinter={receiptPrinter}
          receiptSettings={receiptSettings}
          onClose={() => setDrawerOrderId(null)}
          onAdvance={(id) => {
            handleAdvance(id);
            setDrawerOrderId(null);
          }}
        />
      )}

      {assignFor && (
        <AssignCourierModal
          orderNumber={assignFor.orderNumber}
          onAssign={async (courierId) => {
            await advance(assignFor.orderId, "out_for_delivery", courierId);
          }}
          onClose={() => setAssignFor(null)}
        />
      )}
    </div>
  );
}

function ReviewCell({
  order,
  rowStatus,
  sending,
  onSend,
}: {
  order: OrderRow;
  rowStatus?: { tone: "ok" | "err"; message: string };
  sending: boolean;
  onSend: () => void;
}) {
  // Short-lived per-row toast - wins over any other state so the
  // merchant always sees the result of their click.
  if (rowStatus) {
    return (
      <span
        className={cn(
          "inline-block px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap",
          rowStatus.tone === "ok"
            ? "bg-qf-green-soft text-qf-green-deep"
            : "bg-qf-tomato-soft text-qf-tomato",
        )}
      >
        {rowStatus.message}
      </span>
    );
  }
  if (order.has_review) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-qf-green-soft text-qf-green-deep whitespace-nowrap">
        דורגה
      </span>
    );
  }
  if (order.review_reminder_sent) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium bg-qf-line-soft text-qf-mute whitespace-nowrap">
        בקשה נשלחה
      </span>
    );
  }
  // Only offer the button when there's a real customer attached AND the
  // order has actually been handed off - sending a review prompt before
  // the customer ate their food would be weird, and a guest-phone-less
  // kiosk order has nobody to send to.
  if (order.status !== "delivered" || !order.customer) {
    return <span className="text-xs text-qf-mute">-</span>;
  }
  return (
    <button
      type="button"
      onClick={onSend}
      disabled={sending}
      className="px-3 py-1 rounded-lg bg-(--qf-primary) text-white text-xs font-bold hover:bg-(--qf-deep) disabled:opacity-50 whitespace-nowrap"
    >
      {sending ? "שולח..." : "שלח ביקורת"}
    </button>
  );
}

