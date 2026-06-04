"use client";

import { useEffect, useState } from "react";
import {
  IcoClose,
  IcoPhone,
  IcoPrinter,
  IcoEdit,
  IcoTrash,
  IcoCheck,
  IcoPlus,
  IcoMinus,
} from "@/components/shared/Icons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { formatPrice, formatDateTime, formatRelativeMinutes } from "@/lib/format";
import { cn } from "@/lib/cn";

const EDITABLE_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "in_oven",
  "ready",
]);

interface OrderDetail {
  id: string;
  number: string;
  status: string;
  method: "delivery" | "pickup";
  total: number;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  cutlery_count: number;
  cutlery_fee: number;
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

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "מזומן",
  card: "כרטיס אשראי",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  bit: "ביט",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "ממתין לתשלום",
  paid: "שולם",
  failed: "נכשל",
  refunded: "הוחזר",
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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [pendingDeleteItem, setPendingDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }
  const canEdit = !!order && EDITABLE_STATUSES.has(order.status);

  async function reload() {
    const fresh = await fetch(`/api/v1/customer/orders/${orderId}`);
    if (fresh.ok) {
      const d = await fresh.json();
      setOrder(d.order ?? null);
    }
  }

  async function saveItemEdit(itemId: string, payload: { quantity?: number; notes?: string | null }) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/merchant/orders/${orderId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "עדכון הפריט נכשל");
        return;
      }
      pushToast("ok", "הפריט עודכן");
      setEditingItemId(null);
      await reload();
    } finally {
      setSavingEdit(false);
    }
  }

  async function performItemDelete() {
    if (!pendingDeleteItem) return;
    setSavingEdit(true);
    try {
      const res = await fetch(
        `/api/v1/merchant/orders/${orderId}/items/${pendingDeleteItem.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "מחיקת הפריט נכשלה");
        return;
      }
      pushToast("ok", "הפריט נמחק");
      setPendingDeleteItem(null);
      await reload();
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveAddress(payload: {
    address?: Record<string, string | null>;
    delivery_notes?: string | null;
  }) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/merchant/orders/${orderId}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "עדכון הכתובת נכשל");
        return;
      }
      pushToast("ok", "הכתובת עודכנה");
      setEditingAddress(false);
      await reload();
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveCustomerNotes(notes: string | null) {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/merchant/orders/${orderId}/details`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customer_notes: notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "עדכון ההערה נכשל");
        return;
      }
      pushToast("ok", "ההערה עודכנה");
      setEditingNotes(false);
      await reload();
    } finally {
      setSavingEdit(false);
    }
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
    await reload();
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
                {order.method === "delivery" && (
                  <div className="mt-3">
                    {editingAddress ? (
                      <AddressEditor
                        initial={order.delivery_address}
                        initialNotes={order.delivery_notes}
                        busy={savingEdit}
                        onSave={(addr, notes) =>
                          saveAddress({
                            ...(addr ? { address: addr } : {}),
                            ...(notes !== undefined ? { delivery_notes: notes } : {}),
                          })
                        }
                        onCancel={() => setEditingAddress(false)}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm text-qf-ink2 min-w-0 flex-1">
                          {order.delivery_address ? (
                            <>
                              {order.delivery_address.street}, {order.delivery_address.city}
                              {order.delivery_address.floor && ` · קומה ${order.delivery_address.floor}`}
                              {order.delivery_address.apartment && ` · דירה ${order.delivery_address.apartment}`}
                            </>
                          ) : order.delivery_notes ? (
                            <span>{order.delivery_notes}</span>
                          ) : (
                            <span className="text-qf-mute">ללא כתובת</span>
                          )}
                          {order.delivery_address?.notes && (
                            <div className="text-xs text-qf-mute mt-1">
                              הוראות: {order.delivery_address.notes}
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setEditingAddress(true)}
                            className="shrink-0 w-7 h-7 rounded-md hover:bg-qf-line-soft grid place-items-center text-qf-mute hover:text-qf-ink"
                            aria-label="עריכת כתובת"
                            title="עריכת כתובת"
                          >
                            <IcoEdit s={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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
                  {order.items.map((it) =>
                    editingItemId === it.id ? (
                      <ItemEditor
                        key={it.id}
                        initialQuantity={it.quantity}
                        initialNotes={it.notes ?? ""}
                        busy={savingEdit}
                        onSave={(payload) => saveItemEdit(it.id, payload)}
                        onCancel={() => setEditingItemId(null)}
                      />
                    ) : (
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
                          {Array.isArray(it.options) && (it.options as unknown[]).length > 0 && (
                            <div className="text-xs text-qf-mute">{renderOptions(it.options)}</div>
                          )}
                          {it.notes && (
                            <div className="text-xs text-qf-yolk mt-0.5">הערה: {it.notes}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="text-sm font-semibold tnum">{formatPrice(it.total_price)}</div>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingItemId(it.id)}
                                className="w-7 h-7 rounded-md hover:bg-qf-line-soft grid place-items-center text-qf-mute hover:text-qf-ink"
                                aria-label="עריכת פריט"
                                title="עריכת פריט"
                              >
                                <IcoEdit s={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteItem({ id: it.id, name: it.name })}
                                className="w-7 h-7 rounded-md hover:bg-qf-tomato-soft grid place-items-center text-qf-mute hover:text-qf-tomato"
                                aria-label="מחיקת פריט"
                                title="מחיקת פריט"
                              >
                                <IcoTrash s={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>

              {/* Customer notes */}
              {(order.customer_notes || canEdit) && (
                <section>
                  <div className="text-xs font-semibold text-qf-mute mb-2 flex items-center justify-between">
                    <span>הערת לקוח</span>
                    {canEdit && !editingNotes && (
                      <button
                        type="button"
                        onClick={() => setEditingNotes(true)}
                        className="w-7 h-7 rounded-md hover:bg-qf-line-soft grid place-items-center text-qf-mute hover:text-qf-ink"
                        aria-label="עריכת הערה"
                        title="עריכת הערת לקוח"
                      >
                        <IcoEdit s={14} />
                      </button>
                    )}
                  </div>
                  {editingNotes ? (
                    <NotesEditor
                      initial={order.customer_notes ?? ""}
                      busy={savingEdit}
                      onSave={(notes) => saveCustomerNotes(notes.trim() === "" ? null : notes)}
                      onCancel={() => setEditingNotes(false)}
                    />
                  ) : order.customer_notes ? (
                    <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-sm text-qf-ink2">
                      {order.customer_notes}
                    </div>
                  ) : (
                    <div className="text-xs text-qf-mute italic">אין הערה</div>
                  )}
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
                {order.cutlery_count > 0 && (
                  <SumRow
                    label={`סכו״ם חד״פ × ${order.cutlery_count}`}
                    value={order.cutlery_fee > 0 ? formatPrice(order.cutlery_fee) : "חינם"}
                  />
                )}
                {order.tip > 0 && (
                  <SumRow label="טיפ לשליח" value={formatPrice(order.tip)} />
                )}
                {order.discount > 0 && (
                  <SumRow label="הנחה" value={`-${formatPrice(order.discount)}`} />
                )}
                <SumRow bold label="סה״כ" value={formatPrice(order.total)} />
                <div className="flex items-center justify-between text-xs text-qf-mute pt-1">
                  <span>
                    תשלום: {PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method}
                  </span>
                  <span className={cn(order.payment_status === "paid" ? "text-qf-green-deep" : "text-qf-mute")}>
                    {PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
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
        open={!!pendingDeleteItem}
        title="מחיקת פריט מההזמנה"
        message={
          <p>
            הפריט <span className="font-semibold">{pendingDeleteItem?.name}</span> יוסר
            מההזמנה והסה&quot;כ יחושב מחדש. הפעולה אינה הפיכה.
          </p>
        }
        confirmLabel="מחק פריט"
        cancelLabel="ביטול"
        variant="danger"
        busy={savingEdit}
        onConfirm={performItemDelete}
        onCancel={() => setPendingDeleteItem(null)}
      />

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
            <p className="text-xs bg-qf-tomato-soft border border-qf-tomato/40 text-qf-ink rounded-lg px-3 py-2">
              <strong>הלקוח יקבל מייל ביטול</strong> עם פרטי ההזמנה וסיבת הביטול (אם נכתבה).
              ביטולים תכופים פוגעים באמון הלקוחות במסעדה.
            </p>
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

      {order && <PrintReceipt order={order} />}
    </div>
  );
}

function PrintReceipt({ order }: { order: OrderDetail }) {
  const addr = order.delivery_address;
  return (
    <div className="qf-print-receipt">
      <h1>#{order.number}</h1>
      <div className="qf-pr-row qf-pr-muted">
        <span>{formatDateTime(order.created_at)}</span>
        <span>{order.method === "delivery" ? "משלוח" : "איסוף"}</span>
      </div>
      <div className="qf-pr-rule" />
      <div>{order.customer?.name || "אורח"}</div>
      {order.customer?.phone && <div className="qf-pr-muted">{order.customer.phone}</div>}
      {order.method === "delivery" && (addr || order.delivery_notes) && (
        <div className="qf-pr-muted" style={{ marginTop: "2pt" }}>
          {addr ? (
            <>
              {addr.street}, {addr.city}
              {addr.floor && ` · קומה ${addr.floor}`}
              {addr.apartment && ` · דירה ${addr.apartment}`}
              {addr.notes && (
                <>
                  <br />
                  {addr.notes}
                </>
              )}
            </>
          ) : (
            order.delivery_notes
          )}
        </div>
      )}
      <div className="qf-pr-rule" />
      {order.items.map((it) => (
        <div key={it.id} style={{ marginBottom: "3pt" }}>
          <div className="qf-pr-row">
            <span>
              {it.quantity}× {it.name}
              {it.size ? ` · ${it.size}` : ""}
            </span>
            <span>{formatPrice(it.total_price)}</span>
          </div>
          {Array.isArray(it.options) && (it.options as unknown[]).length > 0 && (
            <div className="qf-pr-muted">{renderOptions(it.options)}</div>
          )}
          {it.notes && <div className="qf-pr-muted">הערה: {it.notes}</div>}
        </div>
      ))}
      <div className="qf-pr-rule" />
      <div className="qf-pr-row qf-pr-muted">
        <span>סכום ביניים</span>
        <span>{formatPrice(order.subtotal)}</span>
      </div>
      {order.method === "delivery" && order.delivery_fee > 0 && (
        <div className="qf-pr-row qf-pr-muted">
          <span>דמי משלוח</span>
          <span>{formatPrice(order.delivery_fee)}</span>
        </div>
      )}
      {order.service_fee > 0 && (
        <div className="qf-pr-row qf-pr-muted">
          <span>דמי שירות</span>
          <span>{formatPrice(order.service_fee)}</span>
        </div>
      )}
      {order.cutlery_count > 0 && (
        <div className="qf-pr-row qf-pr-muted">
          <span>סכו״ם × {order.cutlery_count}</span>
          <span>{order.cutlery_fee > 0 ? formatPrice(order.cutlery_fee) : "חינם"}</span>
        </div>
      )}
      {order.tip > 0 && (
        <div className="qf-pr-row qf-pr-muted">
          <span>טיפ לשליח</span>
          <span>{formatPrice(order.tip)}</span>
        </div>
      )}
      {order.discount > 0 && (
        <div className="qf-pr-row qf-pr-muted">
          <span>הנחה</span>
          <span>-{formatPrice(order.discount)}</span>
        </div>
      )}
      <div className="qf-pr-rule" />
      <div className="qf-pr-row qf-pr-total">
        <span>סה״כ</span>
        <span>{formatPrice(order.total)}</span>
      </div>
      <div className="qf-pr-row qf-pr-muted" style={{ marginTop: "4pt" }}>
        <span>תשלום</span>
        <span>{order.payment_method}</span>
      </div>
      {order.customer_notes && (
        <>
          <div className="qf-pr-rule" />
          <div className="qf-pr-muted">{order.customer_notes}</div>
        </>
      )}
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

// Groups option list entries by (name, half) and renders as
// "name (חצי א׳)" with " ×N" suffix when the same selection
// appears more than once. Without this, an item that picked the
// same modifier in two different groups (very common with
// Wolt-imported menus that have redundant rubrics) shows up as
// "עגבניה · עגבניה" and looks like a glitch to the merchant.
function renderOptions(options: unknown): string {
  if (!Array.isArray(options)) return "";
  const list = options as Array<{ name?: string; half?: string }>;
  const groups = new Map<string, { name: string; half?: string; count: number }>();
  for (const o of list) {
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

function SumRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className={bold ? "font-semibold" : "text-qf-ink2"}>{label}</div>
      <div className={bold ? "font-bold tnum text-base" : "tnum"}>{value}</div>
    </div>
  );
}

function ItemEditor({
  initialQuantity,
  initialNotes,
  busy,
  onSave,
  onCancel,
}: {
  initialQuantity: number;
  initialNotes: string;
  busy: boolean;
  onSave: (payload: { quantity?: number; notes?: string | null }) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [qty, setQty] = useState(initialQuantity);
  const [notes, setNotes] = useState(initialNotes);
  const dirty = qty !== initialQuantity || notes !== initialNotes;
  return (
    <div className="rounded-xl border border-(--qf-primary)/40 bg-(--qf-primary)/5 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-qf-mute">כמות</span>
        <div className="inline-flex items-center bg-white rounded-full border border-qf-line-dash">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={qty <= 1 || busy}
            className="w-9 h-9 grid place-items-center disabled:opacity-40"
            aria-label="הפחת"
          >
            <IcoMinus s={14} />
          </button>
          <div className="w-8 text-center font-bold tnum text-sm">{qty}</div>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(20, q + 1))}
            disabled={qty >= 20 || busy}
            className="w-9 h-9 grid place-items-center disabled:opacity-40"
            aria-label="הוסף"
          >
            <IcoPlus c="#11231a" s={14} />
          </button>
        </div>
      </div>
      <label className="block">
        <span className="text-xs font-semibold text-qf-mute block mb-1">הערה לפריט</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="בלי בצל, חתוך ל-8…"
          className="w-full px-3 py-2 rounded-lg border border-qf-line-dash text-sm resize-none focus:border-(--qf-primary) outline-none bg-white"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-sm"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              ...(qty !== initialQuantity ? { quantity: qty } : {}),
              ...(notes !== initialNotes ? { notes: notes.trim() === "" ? null : notes } : {}),
            })
          }
          disabled={busy || !dirty}
          className="px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-50"
        >
          {busy ? "שומר..." : "שמירה"}
        </button>
      </div>
    </div>
  );
}

function AddressEditor({
  initial,
  initialNotes,
  busy,
  onSave,
  onCancel,
}: {
  initial: OrderDetail["delivery_address"];
  initialNotes: string | null;
  busy: boolean;
  onSave: (
    addr: Record<string, string | null> | null,
    notes: string | null | undefined,
  ) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [street, setStreet] = useState(initial?.street ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [apartment, setApartment] = useState(initial?.apartment ?? "");
  const [floor, setFloor] = useState(initial?.floor ?? "");
  const [addrNotes, setAddrNotes] = useState(initial?.notes ?? "");
  const [deliveryNotes, setDeliveryNotes] = useState(initialNotes ?? "");

  function save() {
    const addr = {
      street: street.trim(),
      city: city.trim(),
      apartment: apartment.trim() || null,
      floor: floor.trim() || null,
      notes: addrNotes.trim() || null,
    };
    onSave(addr, deliveryNotes.trim() === (initialNotes ?? "").trim() ? undefined : deliveryNotes.trim() || null);
  }

  return (
    <div className="rounded-xl border border-(--qf-primary)/40 bg-(--qf-primary)/5 p-3 space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <input
          value={street}
          onChange={(e) => setStreet(e.target.value)}
          placeholder="רחוב + מספר"
          className="col-span-2 px-3 py-2 rounded-lg border border-qf-line-dash text-sm bg-white focus:border-(--qf-primary) outline-none"
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="עיר"
          className="px-3 py-2 rounded-lg border border-qf-line-dash text-sm bg-white focus:border-(--qf-primary) outline-none"
        />
        <input
          value={apartment}
          onChange={(e) => setApartment(e.target.value)}
          placeholder="דירה"
          className="px-3 py-2 rounded-lg border border-qf-line-dash text-sm bg-white focus:border-(--qf-primary) outline-none"
        />
        <input
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          placeholder="קומה"
          className="px-3 py-2 rounded-lg border border-qf-line-dash text-sm bg-white focus:border-(--qf-primary) outline-none"
        />
        <input
          value={addrNotes}
          onChange={(e) => setAddrNotes(e.target.value)}
          placeholder="הוראות הגעה (קוד כניסה...)"
          className="px-3 py-2 rounded-lg border border-qf-line-dash text-sm bg-white focus:border-(--qf-primary) outline-none"
        />
      </div>
      <textarea
        value={deliveryNotes}
        onChange={(e) => setDeliveryNotes(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="הערות משלוח כלליות"
        className="w-full px-3 py-2 rounded-lg border border-qf-line-dash text-sm bg-white resize-none focus:border-(--qf-primary) outline-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-sm"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !street.trim() || !city.trim()}
          className="px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-50"
        >
          {busy ? "שומר..." : "שמירה"}
        </button>
      </div>
    </div>
  );
}

function NotesEditor({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: string;
  busy: boolean;
  onSave: (notes: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={500}
        autoFocus
        placeholder="הערה ללקוח / מטבח"
        className="w-full px-3 py-2 rounded-xl border border-qf-line-dash text-sm bg-white resize-none focus:border-(--qf-primary) outline-none"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-sm"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={() => onSave(text)}
          disabled={busy || text === initial}
          className="px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-50"
        >
          {busy ? "שומר..." : "שמירה"}
        </button>
      </div>
    </div>
  );
}
