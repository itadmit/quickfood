"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PosPaymentSheet } from "@/components/pos/PosPaymentSheet";

interface QueueOrder {
  id: string;
  number: string;
  total: number;
  item_count: number;
  created_at: string;
  customer_phone: string | null;
  customer_name: string | null;
}

export function PosQueue() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QueueOrder | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/merchant/pos/queue", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();

    // SSE: subscribe to the merchant realtime stream and refetch on
    // every new-order event. The endpoint already filters by tenant.
    const es = new EventSource("/api/v1/realtime/merchant");
    es.addEventListener("order.created", () => {
      refetch();
      try {
        // Soft ping when something new lands at the counter.
        const ctx = new ((window as unknown as { AudioContext: typeof AudioContext }).AudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } catch {
        // No audio context on this device — fine, badge is enough.
      }
    });
    return () => es.close();
  }, [refetch]);

  if (loading) {
    return <div className="p-6 text-center text-qf-mute">טוען תור...</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="text-lg font-bold mb-1">אין הזמנות ממתינות</div>
        <p className="text-sm text-qf-mute">
          הזמנות שנעשו בקיוסק עם תשלום במזומן יופיעו כאן.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
        {orders.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setSelected(o)}
            className={cn(
              "text-start rounded-2xl border-2 border-black bg-white p-4 shadow-[0_2px_0_#000] hover:bg-black/5 transition",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-black text-lg">{o.number}</div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-qf-yolk-soft text-qf-ink whitespace-nowrap">
                מזומן
              </span>
            </div>
            <div className="text-xs text-qf-mute mt-1">
              {o.item_count} פריטים · {timeAgo(o.created_at)}
            </div>
            {(o.customer_name || o.customer_phone) && (
              <div className="text-xs text-qf-ink2 mt-1 truncate">
                {o.customer_name ?? ""} {o.customer_phone ? `· ${o.customer_phone.slice(-4)}` : ""}
              </div>
            )}
            <div className="mt-3 text-xl font-black tnum">{formatPrice(o.total)}</div>
          </button>
        ))}
      </div>

      {selected && (
        <PosPaymentSheet
          amount={selected.total}
          isManual={false}
          existingOrderId={selected.id}
          onClose={() => setSelected(null)}
          onPaid={() => {
            setSelected(null);
            refetch();
          }}
        />
      )}
    </>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins === 0) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק'`;
  const h = Math.floor(mins / 60);
  return `לפני ${h} שע'`;
}
