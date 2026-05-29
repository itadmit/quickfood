"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CourierBottomNav } from "@/components/courier/CourierBottomNav";
import { CourierStatusToggle } from "@/components/courier/CourierStatusToggle";
import { CourierLocationTracker } from "@/components/courier/CourierLocationTracker";

interface OrderRow {
  id: string;
  number: string;
  status: string;
  method: "delivery" | "pickup";
  total: number;
  payment_method: string;
  customer_name: string;
  customer_phone: string | null;
  customer_notes: string | null;
  delivery_notes: string | null;
  courier_picked_up_at: string | null;
  ready_at: string | null;
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
}

interface Me {
  id: string;
  name: string;
  status: "available" | "on_delivery" | "break_time" | "offline";
  deliveries_today: number;
  cash_on_hand: number;
  tenant: { name: string };
}

export function CourierHome() {
  const [me, setMe] = useState<Me | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [meRes, ordersRes] = await Promise.all([
      fetch("/api/v1/courier/me"),
      fetch("/api/v1/courier/orders?scope=active"),
    ]);
    if (meRes.ok) {
      const data = await meRes.json();
      if (data.courier) setMe(data.courier);
    }
    if (ordersRes.ok) {
      const data = await ordersRes.json();
      setOrders(data.orders ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  const onDelivery = me?.status === "on_delivery";

  return (
    <main className="min-h-[100dvh] pb-24">
      <CourierLocationTracker enabled={onDelivery} />
      <header className="px-5 pt-8 pb-4 space-y-1">
        <p className="text-xs text-white/50">{me?.tenant.name ?? ""}</p>
        <h1 className="text-2xl font-bold">שלום {me?.name ?? "שליח"}</h1>
      </header>

      <section className="px-5 mb-4">
        <CourierStatusToggle
          status={me?.status ?? "offline"}
          onChange={(s) => setMe((p) => (p ? { ...p, status: s } : p))}
        />
      </section>

      <section className="px-5 grid grid-cols-2 gap-3 mb-5">
        <Stat label="משלוחים היום" value={me?.deliveries_today ?? 0} />
        <Stat
          label="מזומן ביד"
          value={`${me?.cash_on_hand ?? 0} ש"ח`}
        />
      </section>

      <section className="px-5 space-y-3">
        <header className="flex items-center justify-between">
          <h2 className="font-semibold">הזמנות פעילות</h2>
          <span className="text-xs text-white/50 tnum">{orders.length}</span>
        </header>

        {loading && orders.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-sm">טוען...</div>
        ) : orders.length === 0 ? (
          <div className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center text-sm text-white/50">
            אין הזמנות פעילות. כשהמנהל ישייך לך הזמנה, היא תופיע פה.
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </ul>
        )}
      </section>

      <CourierBottomNav active="home" />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
      <p className="text-xs text-white/50">{label}</p>
      <p className="text-2xl font-bold tnum mt-0.5">{value}</p>
    </div>
  );
}

function OrderCard({ order }: { order: OrderRow }) {
  const isCash = order.payment_method === "cash";
  const addressLine = order.address
    ? `${order.address.street}, ${order.address.city}`
    : "ללא כתובת";
  const wazeHref = order.address?.lat && order.address?.lng
    ? `https://waze.com/ul?ll=${order.address.lat},${order.address.lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(addressLine)}&navigate=yes`;
  return (
    <li className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono font-bold tnum">{order.number}</p>
          <p className="text-xs text-white/60">{order.customer_name}</p>
        </div>
        <div className="text-left">
          <p className="font-bold tnum">{order.total} ש&quot;ח</p>
          {isCash ? (
            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-medium mt-0.5">
              מזומן
            </span>
          ) : (
            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-medium mt-0.5">
              שולם
            </span>
          )}
        </div>
      </header>

      <div className="text-sm">
        <p className="text-white/90">{addressLine}</p>
        {(order.address?.apartment || order.address?.floor || order.address?.entrance) && (
          <p className="text-xs text-white/60 mt-0.5">
            {[order.address?.apartment && `דירה ${order.address.apartment}`,
              order.address?.floor && `קומה ${order.address.floor}`,
              order.address?.entrance && `כניסה ${order.address.entrance}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        {(order.address?.notes || order.delivery_notes || order.customer_notes) && (
          <p className="text-xs text-amber-300 mt-1">
            {order.address?.notes || order.delivery_notes || order.customer_notes}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <a
          href={wazeHref}
          target="_blank"
          rel="noreferrer"
          className="py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium text-center"
        >
          Waze
        </a>
        {order.customer_phone && (
          <a
            href={`tel:${order.customer_phone}`}
            className="py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium text-center"
          >
            התקשר
          </a>
        )}
        <Link
          href={`/courier/orders/${order.id}`}
          className="py-2.5 rounded-xl bg-emerald-500 text-[#062017] text-sm font-bold text-center"
        >
          פתח
        </Link>
      </div>
    </li>
  );
}
