"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoBike, IcoPhone, IcoStar } from "@/components/shared/Icons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/merchant/v2/PageHeader";

interface Courier {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  hasLogin: boolean;
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

  useEffect(() => {
    setCouriers(initial);
  }, [initial]);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [vehicle, setVehicle] = useState<"scooter" | "bike" | "car" | "walking">("scooter");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Courier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resetPinFor, setResetPinFor] = useState<Courier | null>(null);
  const [resetPinValue, setResetPinValue] = useState("");
  const [resetEmailValue, setResetEmailValue] = useState("");
  const [resettingPin, setResettingPin] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  const onShift = couriers.filter((c) => c.status !== "offline").length;
  const onDelivery = couriers.filter((c) => c.status === "on_delivery").length;

  function resetForm() {
    setName("");
    setPhone("");
    setEmail("");
    setPin("");
    setVehicle("scooter");
  }

  async function addCourier() {
    if (!name.trim() || !phone.trim() || !email.trim() || !/^\d{4,6}$/.test(pin)) {
      pushToast("err", "מלאו שם, טלפון, מייל ו-PIN בן 4-6 ספרות");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/merchant/couriers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          pin,
          vehicle,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "הוספת שליח נכשלה");
        return;
      }
      const data = await res.json().catch(() => ({}));
      const newCourier: Courier = {
        id: data?.courier?.id ?? crypto.randomUUID(),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        hasLogin: true,
        vehicle,
        status: "offline",
        ratingAvg: 0,
        deliveriesToday: 0,
      };
      setCouriers((prev) => [newCourier, ...prev]);
      router.refresh();
      resetForm();
      setAdding(false);
      pushToast("ok", "השליח נוסף. אפשר להעביר לו את הטלפון/מייל וה-PIN.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: Courier["status"]) {
    const prev = couriers;
    setCouriers((p) => p.map((c) => (c.id === id ? { ...c, status } : c)));
    const res = await fetch(`/api/v1/merchant/couriers/${id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setCouriers(prev);
      pushToast("err", "עדכון סטטוס נכשל");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setDeleting(true);
    const prev = couriers;
    setCouriers((p) => p.filter((c) => c.id !== id));
    const res = await fetch(`/api/v1/merchant/couriers/${id}`, { method: "DELETE" });
    setDeleting(false);
    setPendingDelete(null);
    if (!res.ok) {
      setCouriers(prev);
      const body = await res.json().catch(() => ({}));
      pushToast("err", body?.error?.message ?? "מחיקת שליח נכשלה");
      return;
    }
    pushToast("ok", "השליח הוסר");
  }

  async function confirmResetPin() {
    if (!resetPinFor) return;
    if (!/^\d{4,6}$/.test(resetPinValue)) {
      pushToast("err", "PIN חייב להיות 4-6 ספרות");
      return;
    }
    const needsEmail = !resetPinFor.email;
    if (needsEmail && !resetEmailValue.trim()) {
      pushToast("err", "נדרש מייל לשליח");
      return;
    }
    setResettingPin(true);
    try {
      if (needsEmail) {
        const r = await fetch(`/api/v1/merchant/couriers/${resetPinFor.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: resetEmailValue.trim() }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          pushToast("err", body?.error?.message ?? "עדכון מייל נכשל");
          return;
        }
      }
      const res = await fetch(`/api/v1/merchant/couriers/${resetPinFor.id}/reset-pin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: resetPinValue }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "איפוס PIN נכשל");
        return;
      }
      setResetPinFor(null);
      setResetPinValue("");
      setResetEmailValue("");
      router.refresh();
      pushToast(
        "ok",
        needsEmail ? "החשבון הוגדר בהצלחה" : "PIN עודכן. כל הסשנים הקודמים נותקו.",
      );
    } finally {
      setResettingPin(false);
    }
  }

  return (
    <div className="space-y-4 lg:space-y-5">
      <PageHeader
        chip="תפעול"
        title="שליחים"
        subtitle={`${onShift} במשמרת · ${onDelivery} במשלוח`}
        actions={
          <button
            type="button"
            onClick={() => setAdding(!adding)}
            className="px-3.5 py-2 rounded-xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90"
          >
            {adding ? "ביטול" : "+ הוסף שליח"}
          </button>
        }
      />

      {adding && (
        <div className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="מייל"
              type="email"
              dir="ltr"
              className="px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="PIN (4-6 ספרות)"
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              className="px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum"
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
          <p className="text-xs text-qf-mute">
            השליח יתחבר ב-/courier עם הטלפון או המייל וה-PIN שתבחר. אפשר גם לבקש קישור התחברות במייל בכל זמן.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addCourier}
              disabled={!name || !phone || !email || !pin || busy}
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
                    <div className="font-medium truncate flex items-center gap-1.5">
                      {c.name}
                      {!c.hasLogin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-qf-tomato-soft text-qf-tomato font-medium">
                          חסר חשבון
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-qf-mute">{VEHICLE_LABEL[c.vehicle]}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setResetPinFor(c);
                      setResetPinValue("");
                      setResetEmailValue("");
                    }}
                    className={cn(
                      "text-xs px-2 py-1 rounded-md border",
                      c.hasLogin
                        ? "text-qf-mute hover:text-qf-ink border-qf-line-dash"
                        : "text-qf-tomato border-qf-tomato/40 font-medium hover:bg-qf-tomato-soft",
                    )}
                  >
                    {c.hasLogin ? "איפוס PIN" : "הגדר חשבון"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(c)}
                    className="text-qf-mute hover:text-qf-tomato text-xl leading-none px-1"
                    aria-label="הסר שליח"
                    title="הסר שליח"
                  >
                    ×
                  </button>
                </div>
              </header>

              <div className="flex flex-wrap items-center gap-2 text-xs text-qf-mute">
                <a
                  href={`tel:${c.phone}`}
                  className="inline-flex items-center gap-1.5 hover:text-qf-ink"
                  dir="ltr"
                >
                  <IcoPhone c="#7c8a82" s={12} />
                  {c.phone}
                </a>
                {c.email && (
                  <>
                    <span>·</span>
                    <span dir="ltr" className="truncate max-w-[180px]">
                      {c.email}
                    </span>
                  </>
                )}
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

      <ConfirmDialog
        open={!!pendingDelete}
        title="הסרת שליח"
        message={
          <>
            השליח <span className="font-semibold">&quot;{pendingDelete?.name}&quot;</span> יוסר.
            ההיסטוריה שלו נשמרת, אבל הוא לא יוצג יותר ברשימה ולא יוכל להתחבר.
          </>
        }
        confirmLabel="הסר"
        cancelLabel="ביטול"
        variant="danger"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      {resetPinFor && (
        <div
          className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
          onClick={() => !resettingPin && setResetPinFor(null)}
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-lg">
              {resetPinFor.email ? "איפוס PIN" : "הגדרת חשבון התחברות"}
            </h3>
            <p className="text-sm text-qf-mute">
              {resetPinFor.email ? (
                <>
                  איפוס ה-PIN של <span className="font-medium">{resetPinFor.name}</span>. כל הסשנים
                  הפעילים שלו יתנתקו אוטומטית, ויידרש להתחבר מחדש עם ה-PIN החדש.
                </>
              ) : (
                <>
                  הגדרת מייל ו-PIN ל-<span className="font-medium">{resetPinFor.name}</span> כדי שיוכל להתחבר לאפליקציית השליחים.
                </>
              )}
            </p>
            {!resetPinFor.email && (
              <input
                value={resetEmailValue}
                onChange={(e) => setResetEmailValue(e.target.value)}
                placeholder="מייל"
                type="email"
                dir="ltr"
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
              />
            )}
            <input
              value={resetPinValue}
              onChange={(e) =>
                setResetPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="PIN חדש"
              dir="ltr"
              inputMode="numeric"
              maxLength={6}
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum text-center text-2xl tracking-widest"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setResetPinFor(null)}
                disabled={resettingPin}
                className="px-4 py-2 rounded-xl border border-qf-line-dash text-sm"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={confirmResetPin}
                disabled={resettingPin || !/^\d{4,6}$/.test(resetPinValue)}
                className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm disabled:opacity-60"
              >
                {resettingPin ? "מאפס..." : "אפס"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
