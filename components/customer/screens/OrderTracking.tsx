"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IcoChev, IcoPhone, IcoClock, IcoCheck } from "@/components/shared/Icons";
import { formatPrice, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";

interface OrderData {
  id: string;
  number: string;
  status: string;
  method: "delivery" | "pickup";
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  confirmedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  branch: { phone: string; address: string } | null;
  items: Array<{ id: string; name: string; quantity: number; total: number; size: string | null }>;
}

const STAGES: Array<{ key: string; label: string }> = [
  { key: "received", label: "התקבלה" },
  { key: "preparing", label: "בהכנה" },
  { key: "ready", label: "מוכנה" },
  { key: "delivering", label: "בדרך" },
];

function stageOf(status: string): number {
  if (["pending", "confirmed"].includes(status)) return 0;
  if (["preparing", "in_oven"].includes(status)) return 1;
  if (status === "ready") return 2;
  if (status === "out_for_delivery") return 3;
  if (status === "delivered") return 3;
  return 0;
}

export function OrderTracking({ tenantSlug, order: initialOrder }: { tenantSlug: string; order: OrderData }) {
  const [order, setOrder] = useState(initialOrder);
  const stage = stageOf(order.status);
  const isDelivered = order.status === "delivered";

  // SSE updates
  useEffect(() => {
    const es = new EventSource(`/api/v1/realtime/orders/${order.id}`);
    es.addEventListener("snapshot", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as { status: string };
        setOrder((prev) => ({ ...prev, status: d.status }));
      } catch {
        /* ignore */
      }
    });
    es.addEventListener("status_changed", () => {
      void fetch(`/api/v1/customer/orders/${order.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.order) {
            const o = data.order;
            setOrder((prev) => ({
              ...prev,
              status: o.status,
              readyAt: o.ready_at,
              deliveredAt: o.delivered_at,
              confirmedAt: o.confirmed_at,
            }));
          }
        })
        .catch(() => {});
    });
    return () => es.close();
  }, [order.id]);

  return (
    <div className="pb-20">
      <header className="bg-gradient-to-b from-(--qf-primary) to-(--qf-deep) text-white px-5 pt-5 pb-7 rounded-b-3xl">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/${tenantSlug}`}
            className="w-9 h-9 rounded-full bg-white/15 grid place-items-center"
            aria-label="חזרה"
          >
            <IcoChev c="#fff" s={18} />
          </Link>
          <div className="font-mono text-sm">#{order.number}</div>
        </div>
        <div className="text-center">
          <div className="text-5xl font-bold tnum">
            {isDelivered ? "✓" : "25–35"}
          </div>
          <div className="text-sm mt-1 opacity-85">
            {isDelivered ? "נמסר בהצלחה" : "דקות עד להגעה משוערת"}
          </div>
        </div>
      </header>

      {/* Status card */}
      <section className="px-5 -mt-3">
        <div className="bg-white rounded-2xl border border-qf-line p-4 space-y-4 shadow-sm">
          <div>
            <div className="font-semibold">{STAGES[stage]?.label}</div>
            <div className="text-xs text-qf-mute">
              {order.status === "preparing" && "המסעדה התחילה להכין את ההזמנה שלך"}
              {order.status === "ready" &&
                (order.method === "pickup" ? "מוכן לאיסוף" : "מחכה לשליח")}
              {order.status === "out_for_delivery" && "השליח בדרך אליך"}
              {order.status === "delivered" && "תודה רבה ובתיאבון!"}
            </div>
          </div>

          {/* Progress steps */}
          <ol className="grid grid-cols-4 gap-2">
            {STAGES.map((s, idx) => {
              const done = idx <= stage;
              return (
                <li key={s.key} className="text-center">
                  <div
                    className={cn(
                      "mx-auto w-7 h-7 rounded-full grid place-items-center transition",
                      done ? "bg-(--qf-primary) text-white" : "bg-qf-line-soft text-qf-mute",
                    )}
                  >
                    {done ? <IcoCheck c="#fff" s={14} /> : <span className="text-xs">{idx + 1}</span>}
                  </div>
                  <div className={cn("text-[10px] mt-1", done ? "text-qf-ink" : "text-qf-mute")}>
                    {s.label}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="pt-3 border-t border-qf-line-soft space-y-1.5 text-xs text-qf-mute">
            {order.confirmedAt && (
              <Timestamp icon label="אושרה" t={order.confirmedAt} />
            )}
            {order.readyAt && <Timestamp icon label="מוכנה" t={order.readyAt} />}
            {order.deliveredAt && (
              <Timestamp icon label="נמסרה" t={order.deliveredAt} />
            )}
          </div>
        </div>
      </section>

      {/* Branch contact */}
      {order.branch && (
        <section className="px-5 mt-4">
          <div className="bg-white rounded-2xl border border-qf-line p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-qf-green-soft grid place-items-center text-(--qf-deep) font-bold">
              ?
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">המסעדה</div>
              <div className="text-xs text-qf-mute truncate">{order.branch.address}</div>
            </div>
            <a
              href={`tel:${order.branch.phone}`}
              className="px-3 py-1.5 rounded-full bg-qf-green-soft text-(--qf-deep) text-xs font-medium flex items-center gap-1.5"
              dir="ltr"
            >
              <IcoPhone c="var(--qf-deep)" s={12} />
              <span>{order.branch.phone}</span>
            </a>
          </div>
        </section>
      )}

      {/* Items */}
      <section className="px-5 mt-4">
        <h2 className="font-semibold mb-2">פירוט ההזמנה</h2>
        <div className="bg-white rounded-2xl border border-qf-line divide-y divide-qf-line-soft">
          {order.items.map((it) => (
            <div key={it.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{it.name}</div>
                {it.size && <div className="text-xs text-qf-mute">{it.size}</div>}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-qf-mute text-xs tnum">×{it.quantity}</div>
                <div className="font-medium tnum">{formatPrice(it.total)}</div>
              </div>
            </div>
          ))}
          <div className="px-4 py-3 flex items-center justify-between text-sm font-semibold">
            <div>סה״כ</div>
            <div className="tnum">{formatPrice(order.total)}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Timestamp({ icon, label, t }: { icon?: boolean; label: string; t: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon && <IcoClock c="#7c8a82" s={12} />}
      <span>{label}</span>
      <span className="tnum">· {formatTime(t)}</span>
    </div>
  );
}
