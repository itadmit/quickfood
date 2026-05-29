"use client";

import { useEffect, useState } from "react";
import { IcoBike, IcoPhone } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

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
}: {
  orderNumber: string;
  onAssign: (courierId: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [couriers, setCouriers] = useState<CourierRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

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
    <div
      className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
      onClick={() => assigningId == null && onClose()}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">מסירת הזמנה לשליח</h3>
            <p className="text-xs text-qf-mute">הזמנה {orderNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={assigningId != null}
            className="text-qf-mute hover:text-qf-ink text-2xl leading-none"
            aria-label="סגירה"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {couriers == null && !error && (
            <div className="text-center py-10 text-qf-mute text-sm">טוען שליחים…</div>
          )}
          {error && (
            <div className="text-center py-10 text-qf-tomato text-sm">{error}</div>
          )}
          {couriers && eligible.length === 0 && (
            <div className="border-2 border-dashed border-qf-line-dash rounded-xl p-6 text-center text-sm text-qf-mute">
              אין שליחים זמינים. עברו למסך השליחים כדי להעלות מישהו למשמרת.
            </div>
          )}
          {eligible.length > 0 && (
            <ul className="space-y-2">
              {eligible.map((c) => {
                const overloaded =
                  c.status === "on_delivery" && c.deliveries_today >= c.max_concurrent;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pick(c)}
                      disabled={assigningId != null}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl border text-right transition",
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
      </div>
    </div>
  );
}
