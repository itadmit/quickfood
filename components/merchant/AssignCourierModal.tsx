"use client";

import { useEffect, useState } from "react";
import { IcoBike, IcoPhone, IcoWhatsApp } from "@/components/shared/Icons";
import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/cn";

/** Israeli phone → wa.me international form (972…), digits only. */
function waLink(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  else if (!digits.startsWith("972")) digits = `972${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

interface CourierRow {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: string;
  current_order_id: string | null;
  max_concurrent: number;
  deliveries_today: number;
}

const STATUS_LABEL: Record<string, string> = {
  available: "פנוי",
  on_delivery: "במשלוח",
  break_time: "הפסקה",
  offline: "לא פעיל",
};

export function AssignCourierModal({
  orderNumber,
  onAssign,
  onClose,
  delivApp,
  waText,
}: {
  orderNumber: string;
  onAssign: (courierId: string) => Promise<void> | void;
  onClose: () => void;
  /** Prebuilt order summary for the "send on WhatsApp" button. When omitted the
   *  button falls back to just the order number. */
  waText?: string;
  // Set when the order was handed to DelivApp. The courier is picked in THEIR
  // system and their webhook advances the order, so the in-house picker is the
  // wrong default here - it used to greet the merchant with "no couriers
  // available", which reads as a fault when nothing is wrong.
  delivApp?: { statusLabel: string | null } | null;
}) {
  const managedByDelivApp = !!delivApp;
  const [manual, setManual] = useState(!managedByDelivApp);
  const [couriers, setCouriers] = useState<CourierRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    if (!manual) return;
    let cancelled = false;
    fetch("/api/v1/merchant/couriers", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCouriers(data.couriers ?? []);
      })
      .catch(() => !cancelled && setError("טעינת השליחים נכשלה"));
    return () => {
      cancelled = true;
    };
  }, [manual]);

  const eligible = (couriers ?? [])
    .filter((c) => c.status !== "offline")
    .sort((a, b) => {
      const aBusy = a.status === "on_delivery" ? 1 : 0;
      const bBusy = b.status === "on_delivery" ? 1 : 0;
      if (aBusy !== bBusy) return aBusy - bBusy;
      return a.deliveries_today - b.deliveries_today;
    });

  async function pick(c: CourierRow) {
    setAssigningId(c.id);
    try {
      await onAssign(c.id);
      onClose();
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdrop={assigningId == null}
      size="md"
      ariaLabel="מסירת הזמנה לשליח"
    >
      <header className="sticky top-0 z-10 bg-white flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-qf-line">
        <div className="min-w-0">
          <h3 className="font-semibold text-lg">מסירת הזמנה לשליח</h3>
          <p className="text-xs text-qf-mute">הזמנה {orderNumber}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={assigningId != null}
          className="shrink-0 text-qf-mute hover:text-qf-ink text-2xl leading-none disabled:opacity-50"
          aria-label="סגירה"
        >
          ×
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
          {managedByDelivApp && !manual && (
            <div className="space-y-3">
              <div className="rounded-xl border border-qf-line bg-qf-line-soft px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-xl bg-white border border-qf-line grid place-items-center shrink-0">
                    <IcoBike c="#3a4a40" s={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">השליח מנוהל ב-DelivApp</div>
                    {delivApp?.statusLabel && (
                      <div className="text-xs text-qf-mute">
                        סטטוס נוכחי: <bdi dir="ltr">{delivApp.statusLabel}</bdi>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-qf-ink2 leading-relaxed mt-3">
                  ההזמנה כבר נשלחה ל-DelivApp והשיוך לשליח נעשה אצלם. ההזמנה תתקדם
                  ל&quot;בדרך ללקוח&quot; לבד ברגע שהשליח יאסוף אותה. אין צורך לעשות כאן כלום.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setManual(true)}
                className="w-full text-center py-2.5 rounded-xl border border-qf-line-dash text-xs font-medium text-qf-mute hover:text-qf-ink hover:border-(--qf-primary) transition"
              >
                שיוך שליח פנימי במקום
              </button>
            </div>
          )}

          {manual && managedByDelivApp && (
            <p className="text-xs text-qf-mute mb-3 leading-relaxed">
              ההזמנה כבר אצל DelivApp. שיוך שליח פנימי כאן לא מבטל אותה אצלם - אם השליחות
              שלהם לא רלוונטית, בטלו אותה בצד שלהם.
            </p>
          )}

          {manual && couriers == null && !error && (
            <div className="text-center py-10 text-qf-mute text-sm">טוען שליחים…</div>
          )}
          {error && (
            <div className="text-center py-10 text-qf-tomato text-sm">{error}</div>
          )}
          {manual && couriers && eligible.length === 0 && (
            <div className="border-2 border-dashed border-qf-line-dash rounded-xl p-6 text-center text-sm text-qf-mute">
              אין שליחים זמינים. עברו למסך השליחים כדי להעלות מישהו למשמרת.
            </div>
          )}
          {manual && eligible.length > 0 && (
            <ul className="space-y-2">
              {eligible.map((c) => {
                const overloaded =
                  c.status === "on_delivery" && c.deliveries_today >= c.max_concurrent;
                return (
                  <li key={c.id} className="flex items-stretch gap-2">
                    <a
                      href={waLink(c.phone, waText ?? `הזמנה ${orderNumber}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="שלח את ההזמנה לשליח בוואטסאפ"
                      aria-label="שלח בוואטסאפ"
                      className="shrink-0 w-12 rounded-xl border border-qf-line-dash grid place-items-center hover:border-[#25D366] hover:bg-[#25D366]/10 transition"
                    >
                      <IcoWhatsApp s={22} />
                    </a>
                    <button
                      type="button"
                      onClick={() => pick(c)}
                      disabled={assigningId != null}
                      className={cn(
                        "flex-1 flex items-center gap-3 p-3 rounded-xl border text-right transition",
                        assigningId === c.id
                          ? "border-(--qf-primary) bg-qf-green-soft"
                          : "border-qf-line-dash hover:border-(--qf-primary) hover:bg-qf-line-soft",
                        assigningId != null && assigningId !== c.id && "opacity-50",
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-qf-warm-dash grid place-items-center flex-shrink-0">
                        <IcoBike c="#3a4a40" s={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{c.name}</span>
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded-md",
                              c.status === "available"
                                ? "bg-qf-green-soft text-qf-green-deep"
                                : "bg-qf-yolk-soft text-qf-ink2",
                            )}
                          >
                            {STATUS_LABEL[c.status]}
                          </span>
                          {overloaded && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-qf-tomato-soft text-qf-tomato">
                              עומס
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-qf-mute flex items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center gap-1" dir="ltr">
                            <IcoPhone c="#7c8a82" s={11} />
                            {c.phone}
                          </span>
                          <span>·</span>
                          <span className="tnum">{c.deliveries_today} משלוחים היום</span>
                        </div>
                      </div>
                      <span className="text-xs font-medium text-(--qf-primary)">
                        {assigningId === c.id ? "מוסר…" : "בחר"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </Modal>
  );
}
