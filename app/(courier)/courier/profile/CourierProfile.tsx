"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CourierBottomNav } from "@/components/courier/CourierBottomNav";
import { CashSettleSheet } from "@/components/courier/CashSettleSheet";

interface Me {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  vehicle: string;
  status: string;
  cash_on_hand: number;
  deliveries_today: number;
  rating_avg: number;
  tenant: { name: string };
}

const VEHICLE_LABEL: Record<string, string> = {
  scooter: "קטנוע",
  bike: "אופניים",
  car: "רכב",
  walking: "רגלית",
};

export function CourierProfile() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);

  function loadMe() {
    return fetch("/api/v1/courier/me")
      .then((r) => r.json())
      .then((data) => setMe(data.courier));
  }

  useEffect(() => {
    void loadMe();
  }, []);

  async function logout() {
    setBusy(true);
    await fetch("/api/v1/courier/auth/logout", { method: "POST" });
    router.push("/courier/login");
    router.refresh();
  }

  return (
    <main className="min-h-[100dvh] pb-24">
      <header className="px-5 pt-8 pb-3">
        <h1 className="text-2xl font-bold">פרופיל</h1>
      </header>

      <section className="px-5 space-y-3">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">שם</p>
            <p className="font-medium">{me?.name ?? "—"}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">מסעדה</p>
            <p className="font-medium">{me?.tenant.name ?? "—"}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">כלי תחבורה</p>
            <p className="font-medium">{me ? VEHICLE_LABEL[me.vehicle] : "—"}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/50">טלפון</p>
            <p className="font-medium tnum" dir="ltr">{me?.phone ?? "—"}</p>
          </div>
          {me?.email && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/50">מייל</p>
              <p className="font-medium text-sm" dir="ltr">{me.email}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Stat label="היום" value={me?.deliveries_today ?? 0} />
          <Stat
            label="מזומן ביד"
            value={me ? `${me.cash_on_hand}` : "0"}
            suffix="ש״ח"
          />
          <Stat
            label="דירוג"
            value={me?.rating_avg ? me.rating_avg.toFixed(1) : "—"}
          />
        </div>

        {(me?.cash_on_hand ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => setSettleOpen(true)}
            className="w-full py-3.5 rounded-2xl bg-amber-500 text-[#1a1300] font-bold"
          >
            מסור קופה למנהל · {me?.cash_on_hand} ש&quot;ח
          </button>
        )}

        <button
          type="button"
          onClick={logout}
          disabled={busy}
          className="w-full py-3.5 rounded-2xl border border-rose-500/30 text-rose-300 font-medium disabled:opacity-60"
        >
          התנתקות
        </button>
      </section>

      {settleOpen && me && (
        <CashSettleSheet
          currentAmount={me.cash_on_hand}
          onClose={() => setSettleOpen(false)}
          onDone={async () => {
            setSettleOpen(false);
            await loadMe();
          }}
        />
      )}

      <CourierBottomNav active="profile" />
    </main>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center">
      <p className="text-[10px] text-white/50">{label}</p>
      <p className="text-xl font-bold tnum mt-1">
        {value}
        {suffix && <span className="text-xs font-medium text-white/60 mr-1">{suffix}</span>}
      </p>
    </div>
  );
}
