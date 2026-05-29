"use client";

import { useState } from "react";

export function CashSettleSheet({
  currentAmount,
  onClose,
  onDone,
}: {
  currentAmount: number;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [amountStr, setAmountStr] = useState(String(currentAmount));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("הזן סכום תקין");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/courier/cash-settle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount, ...(notes.trim() ? { notes: notes.trim() } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? "סגירת קופה נכשלה");
        return;
      }
      await onDone();
    } catch {
      setError("בעיית רשת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex items-end justify-center"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-[#0b1a14] rounded-t-3xl border-t border-white/10 w-full max-w-screen-sm p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto" />
        <h3 className="text-lg font-bold text-center">מסירת קופה למנהל</h3>
        <p className="text-sm text-white/60 text-center">
          לפי המערכת אספת <strong className="text-white tnum">{currentAmount} ש״ח</strong> ממסירות
          מזומן. עדכן את הסכום שמסרת בפועל למנהל.
        </p>

        <div>
          <label className="text-xs text-white/60">סכום שמסרת</label>
          <div className="mt-1 relative">
            <input
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value.replace(/[^\d.]/g, ""))}
              dir="ltr"
              inputMode="decimal"
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-2xl font-bold tnum text-center focus:border-white/50 outline-none"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
              ש&quot;ח
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60">הערה (אופציונלי)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 200))}
            placeholder="למשל: מסרתי לאבי במשמרת הערב"
            className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15 text-white placeholder:text-white/30 focus:border-white/50 outline-none"
          />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="py-3.5 rounded-xl border border-white/15 text-white font-medium"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="py-3.5 rounded-xl bg-amber-500 text-[#1a1300] font-bold disabled:opacity-60"
          >
            {busy ? "שומר..." : "אישור מסירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
