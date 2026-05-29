"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeliverSheet } from "@/components/courier/DeliverSheet";
import { CourierLocationTracker } from "@/components/courier/CourierLocationTracker";

interface Item {
  id: string;
  name: string;
  size: string | null;
  quantity: number;
  notes: string | null;
}

interface OrderDetail {
  id: string;
  number: string;
  status: string;
  method: string;
  total: number;
  subtotal: number;
  delivery_fee: number;
  tip: number;
  payment_method: string;
  payment_status: string;
  cash_collected: number | null;
  proof_photo_url: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_notes: string | null;
  delivery_notes: string | null;
  courier_picked_up_at: string | null;
  delivered_at: string | null;
  branch: {
    name: string;
    phone: string;
    address: string;
    lat: number | null;
    lng: number | null;
  } | null;
  address: {
    street: string;
    city: string;
    apartment: string | null;
    floor: string | null;
    entrance: string | null;
    notes: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
  items: Item[];
}

export function CourierOrderDetail({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/courier/orders/${orderId}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "טעינת ההזמנה נכשלה");
      return;
    }
    const data = await res.json();
    setOrder(data.order);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pickup() {
    setBusy(true);
    const res = await fetch(`/api/v1/courier/orders/${orderId}/pickup`, {
      method: "PATCH",
    });
    setBusy(false);
    if (res.ok) await load();
  }

  async function deliver(payload: { cash_collected?: number; proof_photo_url?: string }) {
    setBusy(true);
    const res = await fetch(`/api/v1/courier/orders/${orderId}/deliver`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/courier/home");
      router.refresh();
    }
  }

  if (error) {
    return (
      <main className="min-h-[100dvh] grid place-items-center p-5 text-center">
        <div className="space-y-3">
          <p className="text-rose-400">{error}</p>
          <Link
            href="/courier/home"
            className="inline-block px-4 py-2 rounded-xl bg-white/10 text-white"
          >
            חזרה
          </Link>
        </div>
      </main>
    );
  }
  if (!order) {
    return (
      <main className="min-h-[100dvh] grid place-items-center text-white/50 text-sm">
        טוען...
      </main>
    );
  }

  const addressLine = order.address
    ? `${order.address.street}, ${order.address.city}`
    : "ללא כתובת";
  const wazeHref = order.address?.lat && order.address?.lng
    ? `https://waze.com/ul?ll=${order.address.lat},${order.address.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(addressLine)}&navigate=yes`;
  const isCash = order.payment_method === "cash";
  const pickedUp = !!order.courier_picked_up_at;
  const delivered = order.status === "delivered";

  return (
    <main className="min-h-[100dvh] pb-32">
      <CourierLocationTracker enabled={!delivered} />

      <header className="px-5 pt-6 pb-3 flex items-center justify-between">
        <Link href="/courier/home" className="text-white/60 text-sm">
          ← חזרה
        </Link>
        <p className="font-mono font-bold tnum">{order.number}</p>
      </header>

      <section className="px-5 space-y-4">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-xs text-white/50 mb-1">כתובת המסירה</p>
          <p className="text-lg font-medium">{addressLine}</p>
          {(order.address?.apartment || order.address?.floor || order.address?.entrance) && (
            <p className="text-sm text-white/70 mt-1">
              {[order.address?.apartment && `דירה ${order.address.apartment}`,
                order.address?.floor && `קומה ${order.address.floor}`,
                order.address?.entrance && `כניסה ${order.address.entrance}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {(order.address?.notes || order.delivery_notes) && (
            <p className="text-sm text-amber-300 mt-2">
              {order.address?.notes || order.delivery_notes}
            </p>
          )}
          <a
            href={wazeHref}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block py-3 rounded-xl bg-emerald-500 text-[#062017] text-center font-bold"
          >
            ניווט ב-Waze
          </a>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50">לקוח</p>
              <p className="font-medium">{order.customer_name}</p>
            </div>
            {order.customer_phone && (
              <a
                href={`tel:${order.customer_phone}`}
                className="px-3 py-2 rounded-xl bg-white/10 text-sm"
              >
                התקשרות
              </a>
            )}
          </div>
          {order.customer_notes && (
            <p className="text-sm text-amber-300 pt-1 border-t border-white/10">
              {order.customer_notes}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">תשלום</p>
            <p className="font-bold tnum">{order.total} ש&quot;ח</p>
          </div>
          <p
            className={
              isCash
                ? "text-amber-300 font-medium"
                : "text-emerald-300 font-medium"
            }
          >
            {isCash ? "לגבות במזומן" : "שולם מראש"}
          </p>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
          <p className="text-xs text-white/50 mb-2">פריטים בהזמנה</p>
          <ul className="space-y-1.5 text-sm">
            {order.items.map((it) => (
              <li key={it.id} className="flex gap-2">
                <span className="font-bold tnum text-white/90">{it.quantity}×</span>
                <span className="text-white/80">
                  {it.name}
                  {it.size ? ` · ${it.size}` : ""}
                  {it.notes ? ` — ${it.notes}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="fixed bottom-0 inset-x-0 z-30 bg-[#0b1a14]/95 backdrop-blur border-t border-white/10">
        <div className="max-w-screen-sm mx-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {delivered ? (
            <div className="text-center text-emerald-300 font-medium py-2">
              ההזמנה נמסרה
            </div>
          ) : pickedUp ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeliverOpen(true)}
              className="w-full py-4 rounded-2xl bg-emerald-500 text-[#062017] font-bold text-lg disabled:opacity-60"
            >
              מסרתי ללקוח
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={pickup}
              className="w-full py-4 rounded-2xl bg-emerald-500 text-[#062017] font-bold text-lg disabled:opacity-60"
            >
              {busy ? "מאשר..." : "אספתי את ההזמנה"}
            </button>
          )}
        </div>
      </footer>

      {deliverOpen && (
        <DeliverSheet
          orderId={order.id}
          total={order.total}
          requireCash={isCash}
          onClose={() => setDeliverOpen(false)}
          onSubmit={deliver}
        />
      )}
    </main>
  );
}
