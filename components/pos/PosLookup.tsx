"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePosCart } from "@/components/pos/PosCartProvider";
import { IcoSearch } from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

type Tab = "customer" | "order";

interface CustomerHit {
  id: string;
  name: string;
  phone: string;
  orders_count: number;
}

interface OrderHit {
  id: string;
  number: string;
  total: number;
  payment_status: string;
  status: string;
  created_at: string;
}

export function PosLookup() {
  const [tab, setTab] = useState<Tab>("customer");
  const [q, setQ] = useState("");
  const [customers, setCustomers] = useState<CustomerHit[]>([]);
  const [orders, setOrders] = useState<OrderHit[]>([]);
  const [loading, setLoading] = useState(false);
  const { setCustomer } = usePosCart();
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 2) {
      setCustomers([]);
      setOrders([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const url =
      tab === "customer"
        ? `/api/v1/merchant/customers/search?q=${encodeURIComponent(q)}`
        : `/api/v1/merchant/pos/orders?q=${encodeURIComponent(q)}`;
    fetch(url, { credentials: "include", signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        if (tab === "customer") setCustomers(d.customers ?? []);
        else setOrders(d.orders ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [q, tab]);

  function attachCustomer(c: CustomerHit) {
    setCustomer({ id: c.id, name: c.name, phone: c.phone });
    router.push("/pos");
  }

  return (
    <div className="max-w-2xl mx-auto p-5 space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("customer")}
          className={cn(
            "px-4 py-2 rounded-xl border-2 border-black font-bold text-sm shadow-[0_2px_0_#000]",
            tab === "customer" ? "bg-[#F8CB1E] text-black" : "bg-white text-black",
          )}
        >
          לקוח
        </button>
        <button
          type="button"
          onClick={() => setTab("order")}
          className={cn(
            "px-4 py-2 rounded-xl border-2 border-black font-bold text-sm shadow-[0_2px_0_#000]",
            tab === "order" ? "bg-[#F8CB1E] text-black" : "bg-white text-black",
          )}
        >
          הזמנה
        </button>
      </div>

      <div className="flex items-center gap-2 border-2 border-black rounded-xl bg-white px-3 py-2 shadow-[0_2px_0_#000]">
        <IcoSearch s={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "customer" ? "טלפון או שם" : "מספר הזמנה"}
          className="flex-1 outline-none bg-transparent text-sm"
        />
      </div>

      <div className="space-y-2">
        {loading && <div className="text-sm text-qf-mute py-6 text-center">מחפש...</div>}
        {tab === "customer" &&
          customers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => attachCustomer(c)}
              className="w-full text-start flex items-center justify-between gap-3 rounded-xl bg-white border border-qf-line px-4 py-3 hover:bg-qf-line-soft"
            >
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">{c.name || "ללא שם"}</div>
                <div className="text-xs text-qf-mute" dir="ltr">{c.phone}</div>
              </div>
              <div className="text-xs text-qf-mute whitespace-nowrap">{c.orders_count} הזמנות</div>
            </button>
          ))}
        {tab === "order" &&
          orders.map((o) => (
            <div
              key={o.id}
              className="rounded-xl bg-white border border-qf-line px-4 py-3 flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-bold text-sm">{o.number}</div>
                <div className="text-xs text-qf-mute">
                  {new Date(o.created_at).toLocaleString("he-IL")}
                </div>
              </div>
              <div className="text-end">
                <div className="font-bold tnum text-sm">{formatPrice(o.total)}</div>
                <div className="text-[11px] text-qf-mute">{o.status} · {o.payment_status}</div>
              </div>
            </div>
          ))}
        {!loading && q.trim().length >= 2 && customers.length === 0 && orders.length === 0 && (
          <div className="text-sm text-qf-mute py-6 text-center">לא נמצאו תוצאות</div>
        )}
      </div>
    </div>
  );
}
