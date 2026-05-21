"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoBike, IcoPhone, IcoStar } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

interface Courier {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: string;
  ratingAvg: number;
  deliveriesToday: number;
}

const STATUS_LABEL: Record<string, string> = {
  available: "פנוי",
  on_delivery: "במשלוח",
  break_time: "הפסקה",
  offline: "לא פעיל",
};

const VEHICLE_LABEL: Record<string, string> = {
  scooter: "קטנוע",
  bike: "אופניים",
  car: "רכב",
  walking: "רגלית",
};

export function CouriersView({ initial }: { initial: Courier[] }) {
  const router = useRouter();
  const [couriers, setCouriers] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState<"scooter" | "bike" | "car" | "walking">("scooter");
  const [busy, setBusy] = useState(false);

  const onShift = couriers.filter((c) => c.status !== "offline").length;
  const onDelivery = couriers.filter((c) => c.status === "on_delivery").length;

  async function addCourier() {
    if (!name || !phone) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/merchant/couriers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, phone, vehicle }),
      });
      if (res.ok) {
        router.refresh();
        setName("");
        setPhone("");
        setAdding(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: Courier["status"]) {
    setCouriers((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    await fetch(`/api/v1/merchant/couriers/${id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function remove(id: string) {
    if (!confirm("למחוק את השליח?")) return;
    const prev = couriers;
    setCouriers((p) => p.filter((c) => c.id !== id));
    const res = await fetch(`/api/v1/merchant/couriers/${id}`, { method: "DELETE" });
    if (!res.ok) setCouriers(prev);
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">שליחים</h1>
          <p className="text-xs lg:text-sm text-qf-mute">
            {onShift} במשמרת · {onDelivery} במשלוח
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          className="px-3.5 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm"
        >
          {adding ? "ביטול" : "+ הוסף שליח"}
        </button>
      </header>

      {adding && (
        <div className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם השליח"
              className="px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="טלפון"
              dir="ltr"
              className="px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
            <select
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value as typeof vehicle)}
              className="px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            >
              <option value="scooter">קטנוע</option>
              <option value="bike">אופניים</option>
              <option value="car">רכב</option>
              <option value="walking">רגלית</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addCourier}
              disabled={!name || !phone || busy}
              className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm disabled:opacity-60"
            >
              {busy ? "מוסיף..." : "הוסף"}
            </button>
          </div>
        </div>
      )}

      {couriers.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-qf-line-dash p-10 text-center text-qf-mute">
          אין שליחים. הוסף את הראשון כדי להתחיל לנהל משלוחים.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {couriers.map((c) => (
            <article
              key={c.id}
              className="bg-white rounded-2xl border border-qf-line-dash p-4 space-y-3"
            >
              <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-qf-warm-dash grid place-items-center">
                    <IcoBike c="#3a4a40" s={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-qf-mute">{VEHICLE_LABEL[c.vehicle]}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="text-qf-mute hover:text-qf-tomato text-xl leading-none"
                  aria-label="הסר"
                >
                  ×
                </button>
              </header>

              <div className="flex items-center gap-3 text-xs text-qf-mute">
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex items-center gap-1.5 hover:text-qf-ink"
                  dir="ltr"
                >
                  <IcoPhone c="#7c8a82" s={12} />
                  {c.phone}
                </a>
                <span>·</span>
                <span className="inline-flex items-center gap-1 tnum">
                  <IcoStar c="#e8a93b" fill="#e8a93b" s={12} />
                  {c.ratingAvg.toFixed(1)}
                </span>
                <span>·</span>
                <span className="tnum">{c.deliveriesToday} משלוחים היום</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-xs">
                {(["available", "on_delivery", "break_time", "offline"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(c.id, s)}
                    className={cn(
                      "py-1.5 rounded-lg border transition",
                      c.status === s
                        ? "border-(--qf-primary) bg-qf-green-soft text-qf-green-deep font-medium"
                        : "border-qf-line-dash text-qf-ink2 hover:bg-qf-line-soft",
                    )}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
