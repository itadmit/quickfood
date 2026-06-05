"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoBike, IcoPhone, IcoStar } from "@/components/shared/Icons";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/merchant/v2/PageHeader";
import { CourierQRModal } from "@/components/merchant/CourierQRModal";

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
  cashOnHand: number;
  tipsOnHand: number;
  tipsOwed: number;
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
  const [qrFor, setQrFor] = useState<Courier | null>(null);
  const [copyingLinkFor, setCopyingLinkFor] = useState<string | null>(null);
  const [settleFor, setSettleFor] = useState<Courier | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settling, setSettling] = useState(false);
  const [tipsPayoutFor, setTipsPayoutFor] = useState<Courier | null>(null);
  const [payingTips, setPayingTips] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (settleFor) setSettleAmount(String(settleFor.cashOnHand));
  }, [settleFor]);

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
        cashOnHand: 0,
        tipsOnHand: 0,
        tipsOwed: 0,
      };
      setCouriers((prev) => [newCourier, ...prev]);
      router.refresh();
      resetForm();
      setAdding(false);
      setQrFor(newCourier);
      pushToast("ok", "השליח נוסף. הצג לו את ה-QR או שלח לו את הקישור.");
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

  async function confirmSettle() {
    if (!settleFor) return;
    const amount = Number(settleAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      pushToast("err", "סכום לא תקין");
      return;
    }
    setSettling(true);
    try {
      const res = await fetch(`/api/v1/merchant/couriers/${settleFor.id}/cash-settle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "סגירת קופה נכשלה");
        return;
      }
      const data = await res.json();
      setCouriers((prev) =>
        prev.map((c) =>
          c.id === settleFor.id ? { ...c, cashOnHand: data.cash_on_hand ?? 0 } : c,
        ),
      );
      setSettleFor(null);
      setSettleAmount("");
      pushToast("ok", `נסגרה קופה של ${amount} ש"ח`);
    } finally {
      setSettling(false);
    }
  }

  async function confirmTipsPayout() {
    if (!tipsPayoutFor) return;
    setPayingTips(true);
    try {
      const res = await fetch(
        `/api/v1/merchant/couriers/${tipsPayoutFor.id}/tips-payout`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "אישור תשלום הטיפים נכשל");
        return;
      }
      const data = await res.json();
      setCouriers((prev) =>
        prev.map((c) =>
          c.id === tipsPayoutFor.id ? { ...c, tipsOwed: data.tips_owed ?? 0 } : c,
        ),
      );
      pushToast("ok", `סומן ששילמת ${tipsPayoutFor.tipsOwed} ש"ח טיפים`);
      setTipsPayoutFor(null);
    } finally {
      setPayingTips(false);
    }
  }

  async function copyLoginLink(courier: Courier) {
    if (copyingLinkFor) return;
    setCopyingLinkFor(courier.id);
    try {
      const res = await fetch(`/api/v1/merchant/couriers/${courier.id}/magic-link`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "יצירת קישור נכשלה");
        return;
      }
      const data = await res.json();
      const url = data?.url as string | undefined;
      if (!url) {
        pushToast("err", "השרת לא החזיר קישור");
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        const ttl = typeof data.ttl_minutes === "number" ? data.ttl_minutes : null;
        pushToast(
          "ok",
          ttl
            ? `הקישור הועתק. תקף ${ttl} דקות — שלח/י ב-WhatsApp/SMS.`
            : "הקישור הועתק. שלח/י ב-WhatsApp/SMS.",
        );
      } catch {
        pushToast("err", "לא ניתן היה להעתיק. פתח/י QR והעתק/י משם.");
      }
    } finally {
      setCopyingLinkFor(null);
    }
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
                  {c.hasLogin && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyLoginLink(c)}
                        disabled={copyingLinkFor === c.id}
                        className="text-xs px-2 py-1 rounded-md border border-qf-line-dash text-qf-mute hover:text-qf-ink disabled:opacity-60"
                        title="העתקת קישור חד-פעמי לאפליקציית השליחים"
                      >
                        {copyingLinkFor === c.id ? "מעתיק..." : "קישור"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrFor(c)}
                        className="text-xs px-2 py-1 rounded-md border border-qf-line-dash text-qf-mute hover:text-qf-ink"
                        title="קוד QR לסריקה ושיתוף ב-WhatsApp"
                      >
                        QR
                      </button>
                    </>
                  )}
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

              {c.cashOnHand > 0 && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-qf-yolk-soft border border-qf-yolk/40">
                  <div className="text-xs leading-tight">
                    <div>
                      <span className="text-qf-mute">לקופה (שלך): </span>
                      <span className="font-bold tnum text-qf-ink">{c.cashOnHand} ש&quot;ח</span>
                    </div>
                    {c.tipsOnHand > 0 && (
                      <div className="text-qf-mute mt-0.5">
                        טיפים של השליח: <span className="tnum">{c.tipsOnHand} ש&quot;ח</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettleFor(c)}
                    className="text-xs px-2.5 py-1 rounded-md bg-black text-[#F8CB1E] font-medium hover:bg-black/90"
                  >
                    סגירת קופה
                  </button>
                </div>
              )}

              {c.cashOnHand === 0 && c.tipsOnHand > 0 && (
                <div className="px-3 py-2 rounded-lg bg-qf-green-soft border border-(--qf-primary)/30 text-xs">
                  <span className="text-qf-mute">טיפים אצל השליח: </span>
                  <span className="font-bold tnum text-qf-green-deep">{c.tipsOnHand} ש&quot;ח</span>
                </div>
              )}

              {c.tipsOwed > 0 && (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-qf-tomato-soft border border-qf-tomato/40">
                  <div className="text-xs leading-tight">
                    <div className="text-qf-tomato font-medium">חוב טיפים לשליח</div>
                    <div className="text-qf-mute mt-0.5">
                      <span className="font-bold tnum text-qf-ink">{c.tipsOwed} ש&quot;ח</span>
                      <span> · נגבו בכרטיס אשראי, להחזיר במזומן</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTipsPayoutFor(c)}
                    className="text-xs px-2.5 py-1 rounded-md border border-qf-tomato/60 text-qf-tomato font-medium hover:bg-qf-tomato/10"
                  >
                    שילמתי
                  </button>
                </div>
              )}

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
        <Modal
          open
          onClose={() => setResetPinFor(null)}
          closeOnBackdrop={!resettingPin}
          size="sm"
          ariaLabel={resetPinFor.email ? "איפוס PIN" : "הגדרת חשבון התחברות"}
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
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
        </Modal>
      )}

      {settleFor && (
        <Modal
          open
          onClose={() => setSettleFor(null)}
          closeOnBackdrop={!settling}
          size="sm"
          ariaLabel="סגירת קופה"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            <header>
              <h3 className="font-semibold text-lg">סגירת קופה</h3>
              <p className="text-sm text-qf-mute">
                {settleFor.name} · המערכת ספרה{" "}
                <span className="font-medium tnum">{settleFor.cashOnHand} ש&quot;ח</span>
              </p>
            </header>
            <div>
              <label className="text-xs text-qf-mute">סכום שקיבלת בפועל</label>
              <div className="mt-1 relative">
                <input
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  dir="ltr"
                  inputMode="decimal"
                  className="w-full px-4 py-3 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum text-2xl font-bold text-center"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-qf-mute text-xs">
                  ש&quot;ח
                </span>
              </div>
            </div>
            <p className="text-[11px] text-qf-mute">
              לאחר אישור הקופה תאופס. כל הסגירות נשמרות בלוג היסטוריה.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSettleFor(null)}
                disabled={settling}
                className="px-4 py-2 rounded-xl border border-qf-line-dash text-sm"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={confirmSettle}
                disabled={settling || Number(settleAmount) <= 0}
                className="px-4 py-2 rounded-xl bg-black text-[#F8CB1E] text-sm font-bold disabled:opacity-60"
              >
                {settling ? "סוגר..." : "סגירה ואיפוס"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!tipsPayoutFor}
        title="תשלום טיפים לשליח"
        message={
          <>
            לאשר שמסרת לשליח{" "}
            <span className="font-semibold">{tipsPayoutFor?.name}</span>{" "}
            <span className="font-bold tnum">{tipsPayoutFor?.tipsOwed} ש&quot;ח</span>{" "}
            טיפים שנגבו בכרטיס אשראי? החוב יאופס.
          </>
        }
        confirmLabel="שילמתי"
        cancelLabel="ביטול"
        busy={payingTips}
        onConfirm={confirmTipsPayout}
        onCancel={() => setTipsPayoutFor(null)}
      />

      {qrFor && (
        <CourierQRModal
          courierId={qrFor.id}
          courierName={qrFor.name}
          onClose={() => setQrFor(null)}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
