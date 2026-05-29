"use client";

import { useEffect, useState } from "react";
import { CourierBottomNav } from "@/components/courier/CourierBottomNav";

interface HistoryRow {
  id: string;
  number: string;
  status: string;
  total: number;
  delivered_at: string | null;
  customer_name: string;
  address: { street: string; city: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  delivered: "נמסר",
  cancelled: "בוטל",
  refunded: "הוחזר",
};

export function CourierHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/courier/orders?scope=history")
      .then((r) => r.json())
      .then((data) => setRows(data.orders ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-[100dvh] pb-24">
      <header className="px-5 pt-8 pb-3">
        <h1 className="text-2xl font-bold">היסטוריה</h1>
        <p className="text-sm text-white/50">30 ההזמנות האחרונות שלך</p>
      </header>

      <section className="px-5">
        {loading ? (
          <p className="text-center py-10 text-white/40 text-sm">טוען...</p>
        ) : rows.length === 0 ? (
          <div className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center text-sm text-white/50">
            אין עדיין הזמנות בהיסטוריה
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl bg-white/5 border border-white/10 p-3.5 flex items-center justify-between"
              >
                <div>
                  <p className="font-mono font-bold tnum text-sm">{r.number}</p>
                  <p className="text-xs text-white/60">
                    {r.customer_name}
                    {r.address ? ` · ${r.address.street}, ${r.address.city}` : ""}
                  </p>
                </div>
                <div className="text-left">
                  <p className="font-bold tnum text-sm">{r.total} ש&quot;ח</p>
                  <p
                    className={
                      r.status === "delivered"
                        ? "text-emerald-300 text-xs"
                        : "text-white/50 text-xs"
                    }
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CourierBottomNav active="history" />
    </main>
  );
}
