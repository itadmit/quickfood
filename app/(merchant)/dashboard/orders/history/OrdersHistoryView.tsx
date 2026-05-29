"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

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
}

interface Meta {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "ממתינה",
  confirmed: "אושרה",
  preparing: "בהכנה",
  in_oven: "בתנור",
  ready: "מוכנה",
  out_for_delivery: "במשלוח",
  delivered: "נמסרה",
  cancelled: "בוטלה",
  refunded: "הוחזרה",
};

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
  });
}

export function OrdersHistoryView() {
  const [status, setStatus] = useState<string>("");
  const [method, setMethod] = useState<string>("");
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

  // Debounce the search input so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever any filter changes.
  useEffect(() => {
    setPage(1);
  }, [status, method, from, to, debouncedSearch]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (method) params.set("method", method);
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
  }, [status, method, from, to, debouncedSearch, page, perPage]);

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
        subtitle={`${meta.total} הזמנות תואמות לסינון · הכנסה בעמוד הנוכחי ${formatPrice(summary.totalRev)}`}
        actions={
          <Link
            href="/dashboard/orders"
            className="px-3.5 py-2 rounded-xl border-2 border-black text-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
          >
            הזמנות חיות
          </Link>
        }
      />

      <div className="bg-white rounded-2xl border border-qf-line-dash p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
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
              </tr>
            </thead>
            <tbody>
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-qf-mute">
                    טוען...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-qf-mute">
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
                      className="border-t border-qf-line-soft hover:bg-qf-line-soft/30"
                    >
                      <td className="px-3 py-2 font-mono font-semibold">{o.number}</td>
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
                      <td className="px-3 py-2">
                        <StatusPill status={o.status} />
                      </td>
                      <td className="px-3 py-2 text-qf-ink2 whitespace-nowrap">
                        {PAYMENT_LABEL[o.payment_method] ?? o.payment_method}
                        <span className="text-xs text-qf-mute me-1">
                          · {PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 tnum font-medium text-end">
                        {formatPrice(o.total)}
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
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const tone: Record<Status, string> = {
    pending: "bg-qf-yolk-soft text-qf-ink",
    confirmed: "bg-qf-green-soft text-qf-green-deep",
    preparing: "bg-qf-yolk-soft text-qf-ink",
    in_oven: "bg-qf-yolk-soft text-qf-ink",
    ready: "bg-qf-green-soft text-qf-green-deep",
    out_for_delivery: "bg-qf-green-soft text-qf-green-deep",
    delivered: "bg-qf-line-soft text-qf-ink2",
    cancelled: "bg-qf-tomato-soft text-qf-tomato",
    refunded: "bg-qf-tomato-soft text-qf-tomato",
  };
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap",
        tone[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
