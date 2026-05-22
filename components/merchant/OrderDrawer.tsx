"use client";

import { useEffect, useState } from "react";
import { IcoClose, IcoPhone, IcoPrinter } from "@/components/shared/Icons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { formatPrice, formatDateTime, formatRelativeMinutes } from "@/lib/format";
import { cn } from "@/lib/cn";

interface OrderDetail {
  id: string;
  number: string;
  status: string;
  method: "delivery" | "pickup";
  total: number;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  tip: number;
  discount: number;
  payment_method: string;
  payment_status: string;
  customer_notes: string | null;
  delivery_notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  branch: { name: string; address: string; phone: string } | null;
  customer: { name: string | null; phone: string | null } | null;
  delivery_address: {
    street: string;
    city: string;
    floor: string | null;
    apartment: string | null;
    notes: string | null;
  } | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    size: string | null;
    options: unknown;
    notes: string | null;
  }>;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתינה",
  confirmed: "אושרה",
  preparing: "בהכנה",
  in_oven: "בתנור",
  ready: "מוכנה",
  out_for_delivery: "בדרך",
  delivered: "נמסרה",
  cancelled: "בוטלה",
  refunded: "הוחזרה",
};

export function OrderDrawer({
  orderId,
  onClose,
  onAdvance,
}: {
  orderId: string;
  onClose: () => void;
  onAdvance: (id: string) => void;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  async function performRefund() {
    if (!order) return;
    setRefunding(true);
    const res = await fetch(`/api/v1/merchant/orders/${order.id}/refund`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: refundReason || undefined, cancel_workflow: true }),
    });
    const data = await res.json();
    setRefunding(false);
    setConfirmRefund(false);
    if (!res.ok) {
      pushToast("err", data?.error?.message ?? "החזרת הזמנה נכשלה");
      return;
    }
    pushToast(
      "ok",
      data.money_action_required
        ? `סומן כהוחזר. שים לב: ${data.money_action_required}`
        : "ההזמנה הוחזרה",
    );
    // Re-fetch to reflect new status in the drawer
    const fresh = await fetch(`/api/v1/customer/orders/${order.id}`);
    if (fresh.ok) {
      const d = await fresh.json();
      setOrder(d.order ?? null);
    }
  }

  useEffect(() => {
    let alive = true;
    fetch(`/api/v1/customer/orders/${orderId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setOrder(d.order ?? null);
        setLoading(false);
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [orderId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative ms-auto h-full w-full max-w-[480px] bg-white shadow-2xl flex flex-col overflow-hidden">
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-qf-line-soft">
          <div>
            <div className="text-xs text-qf-mute">
              {order ? formatRelativeMinutes(order.created_at) : "..."} ·{" "}
              {order?.method === "delivery" ? "משלוח" : "איסוף"}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-xl font-bold font-mono">#{order?.number ?? "..."}</h2>
              {order && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-qf-green-soft text-qf-green-deep">
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-qf-line-soft grid place-items-center text-qf-mute"
            aria-label="סגור"
          >
            <IcoClose s={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="text-center text-sm text-qf-mute py-10">טוען...</div>
          ) : !order ? (
            <div className="text-center text-sm text-qf-mute py-10">הזמנה לא נמצאה</div>
          ) : (
            <>
              {/* Customer */}
              <section className="bg-qf-line-soft/60 rounded-2xl p-4">
                <div className="text-xs text-qf-mute mb-1">לקוח</div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-(--qf-primary) text-white grid place-items-center font-bold">
                    {(order.customer?.name || "א").slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{order.customer?.name || "אורח"}</div>
                    {order.customer?.phone && (
                      <a
                        href={`tel:${order.customer.phone}`}
                        className="text-xs text-qf-mute hover:text-(--qf-deep) inline-flex items-center gap-1"
                        dir="ltr"
                      >
                        <IcoPhone c="#7c8a82" s={12} />
                        {order.customer.phone}
                      </a>
                    )}
                  </div>
                </div>
                {order.delivery_address && (
                  <div className="mt-3 text-sm text-qf-ink2">
                    {order.delivery_address.street}, {order.delivery_address.city}
                    {order.delivery_address.floor && ` · קומה ${order.delivery_address.floor}`}
                    {order.delivery_address.apartment && ` דירה ${order.delivery_address.apartment}`}
                  </div>
                )}
                {order.delivery_notes && (
                  <div className="mt-2 text-xs text-qf-mute">הוראות: {order.delivery_notes}</div>
                )}
              </section>

              {/* Timeline */}
              <section>
                <div className="text-xs font-semibold text-qf-mute mb-2">ציר זמן</div>
                <ol className="space-y-1.5 text-xs">
                  <TimelineRow label="התקבלה" at={order.created_at} done />
                  {order.confirmed_at && <TimelineRow label="אושרה" at={order.confirmed_at} done />}
                  {order.ready_at && <TimelineRow label="מוכנה" at={order.ready_at} done />}
                  {order.delivered_at && <TimelineRow label="נמסרה" at={order.delivered_at} done />}
                </ol>
              </section>

              {/* Items */}
              <section>
                <div className="text-xs font-semibold text-qf-mute mb-2">פריטים</div>
                <div className="space-y-1.5">
                  {order.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-qf-line-soft"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <span className="tnum text-qf-mute">×{it.quantity}</span>
                          <span className="truncate">{it.name}</span>
                        </div>
                        {it.size && <div className="text-xs text-qf-mute">{it.size}</div>}
                        {Array.isArray(it.options) && (it.options as Array<{ name: string }>).length > 0 && (
                          <div className="text-xs text-qf-mute">
                            {(it.options as Array<{ name: string }>).map((o) => o.name).join(" · ")}
                          </div>
                        )}
                        {it.notes && (
                          <div className="text-xs text-qf-yolk mt-0.5">הערה: {it.notes}</div>
                        )}
                      </div>
                      <div className="text-sm font-semibold tnum">{formatPrice(it.total_price)}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Customer notes */}
              {order.customer_notes && (
                <section>
                  <div className="text-xs font-semibold text-qf-mute mb-2">הערת לקוח</div>
                  <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-sm text-qf-ink2">
                    {order.customer_notes}
                  </div>
                </section>
              )}

              {/* Summary */}
              <section className="bg-qf-line-soft/60 rounded-2xl p-4 space-y-1.5 text-sm">
                <SumRow label="סכום ביניים" value={formatPrice(order.subtotal)} />
                {order.method === "delivery" && (
                  <SumRow label="דמי משלוח" value={formatPrice(order.delivery_fee)} />
                )}
                {order.service_fee > 0 && (
                  <SumRow label="דמי שירות" value={formatPrice(order.service_fee)} />
                )}
                {order.tip > 0 && <SumRow label="טיפ" value={formatPrice(order.tip)} />}
                {order.discount > 0 && (
                  <SumRow label="הנחה" value={`-${formatPrice(order.discount)}`} />
                )}
                <SumRow bold label="סה״כ" value={formatPrice(order.total)} />
                <div className="flex items-center justify-between text-xs text-qf-mute pt-1">
                  <span>תשלום: {order.payment_method}</span>
                  <span className={cn(order.payment_status === "paid" ? "text-qf-green-deep" : "text-qf-mute")}>
                    {order.payment_status}
                  </span>
                </div>
              </section>
            </>
          )}
        </div>

        {order && (
          <footer className="border-t border-qf-line-soft px-5 py-3 flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl border border-qf-line-dash hover:bg-qf-line-soft text-sm inline-flex items-center gap-2"
            >
              <IcoPrinter s={14} /> הדפסה
            </button>
            {order.status !== "refunded" && order.status !== "cancelled" && (
              <button
                type="button"
                onClick={() => setConfirmRefund(true)}
                className="px-3 py-2 rounded-xl border border-qf-tomato/40 text-qf-tomato hover:bg-qf-tomato-soft text-sm"
              >
                החזרה / ביטול
              </button>
            )}
            <button
              type="button"
              onClick={() => onAdvance(order.id)}
              disabled={order.status === "refunded" || order.status === "cancelled"}
              className="flex-1 px-3 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              קדם סטטוס
            </button>
          </footer>
        )}
      </aside>

      <ConfirmDialog
        open={confirmRefund}
        title="החזרה / ביטול הזמנה"
        message={
          <div className="space-y-2">
            <p>
              ההזמנה <span className="font-mono font-semibold">#{order?.number}</span> תסומן
              כהוחזרה ותועבר לסטטוס &quot;הוחזרה&quot;. וובהוק `order.refunded` יישלח.
            </p>
            {order?.payment_method !== "cash" && (
              <p className="text-xs bg-qf-yolk-soft border border-qf-yolk/40 rounded-lg px-3 py-2">
                <strong>שים לב:</strong> לתשלום בכרטיס, ההחזר עצמו צריך להתבצע ידנית בלוח
                הבקרה של Grow Payments. הסטטוס במערכת רק מסמן שזה קרה.
              </p>
            )}
            <label className="block">
              <span className="text-xs font-medium block mb-1">סיבה (אופציונלי)</span>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="למשל: ביטול לבקשת הלקוח"
                className="w-full px-3 py-2 rounded-lg border border-qf-line-dash text-sm resize-none"
              />
            </label>
          </div>
        }
        confirmLabel="החזר / בטל"
        cancelLabel="ביטול"
        variant="danger"
        busy={refunding}
        onConfirm={performRefund}
        onCancel={() => {
          setConfirmRefund(false);
          setRefundReason("");
        }}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function TimelineRow({ label, at, done }: { label: string; at: string; done?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          done ? "bg-(--qf-primary)" : "bg-qf-line-dash",
        )}
      />
      <span className={done ? "text-qf-ink" : "text-qf-mute"}>{label}</span>
      <span className="text-qf-mute tnum">· {formatDateTime(at)}</span>
    </li>
  );
}

function SumRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className={bold ? "font-semibold" : "text-qf-ink2"}>{label}</div>
      <div className={bold ? "font-bold tnum text-base" : "tnum"}>{value}</div>
    </div>
  );
}
