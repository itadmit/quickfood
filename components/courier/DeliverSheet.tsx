"use client";

import { useRef, useState } from "react";

export function DeliverSheet({
  orderId,
  total,
  tip,
  requireCash,
  onSubmit,
  onClose,
}: {
  orderId: string;
  total: number;
  tip: number;
  requireCash: boolean;
  onSubmit: (payload: { cash_collected?: number; proof_photo_url?: string }) => Promise<void> | void;
  onClose: () => void;
}) {
  const orderPortion = Math.max(0, total - tip);
  const [cashStr, setCashStr] = useState(requireCash ? String(total) : "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handlePhoto(file: File) {
    setUploadingPhoto(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("order_id", orderId);
      const res = await fetch("/api/v1/courier/upload-proof", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? "העלאת תמונה נכשלה");
        return;
      }
      const data = await res.json();
      setPhotoUrl(data.url);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function submit() {
    if (requireCash) {
      const n = Number(cashStr);
      if (!Number.isFinite(n) || n < 0) {
        setError("הזן סכום מזומן תקין");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        ...(requireCash ? { cash_collected: Number(cashStr) } : {}),
        ...(photoUrl ? { proof_photo_url: photoUrl } : {}),
      });
    } catch {
      setError("שמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-40 flex items-end justify-center"
      onClick={() => !busy && !uploadingPhoto && onClose()}
    >
      <div
        className="bg-[#0b1a14] rounded-t-3xl border-t border-white/10 w-full max-w-screen-sm p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4 animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto" />
        <h3 className="text-lg font-bold text-center">אישור מסירה</h3>

        {requireCash && (
          <div className="space-y-3">
            {tip > 0 && (
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 space-y-1.5">
                <p className="text-[11px] text-emerald-200/80 uppercase tracking-wide">
                  פירוט הגבייה
                </p>
                <div className="flex justify-between text-sm text-white/80">
                  <span>סכום ההזמנה</span>
                  <span className="tnum font-medium">{orderPortion} ש&quot;ח</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-200">טיפ שלך</span>
                  <span className="tnum font-bold text-emerald-200">{tip} ש&quot;ח</span>
                </div>
                <div className="flex justify-between text-sm pt-1.5 border-t border-emerald-400/20">
                  <span className="text-white/90 font-medium">סה&quot;כ לגבייה</span>
                  <span className="tnum font-bold text-white">{total} ש&quot;ח</span>
                </div>
                <p className="text-[11px] text-emerald-200/80 pt-1">
                  הטיפ נשאר אצלך — לא נכלל בסגירת הקופה מול בעל העסק.
                </p>
              </div>
            )}
            <div>
              <label className="text-xs text-white/60">סכום מזומן שנגבה</label>
              <div className="mt-1 relative">
                <input
                  value={cashStr}
                  onChange={(e) => setCashStr(e.target.value.replace(/[^\d.]/g, ""))}
                  dir="ltr"
                  inputMode="decimal"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/15 text-white text-2xl font-bold tnum text-center focus:border-white/50 outline-none"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                  ש&quot;ח
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/10 p-3 space-y-2">
          <p className="text-xs text-white/60">תמונת מסירה (אופציונלי)</p>
          {photoUrl ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-emerald-300">תמונה הועלתה</span>
              <button
                type="button"
                onClick={() => setPhotoUrl(null)}
                className="text-xs text-white/50 underline"
              >
                החלף
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploadingPhoto}
              className="w-full py-2.5 rounded-xl border border-white/15 text-sm text-white/80 disabled:opacity-60"
            >
              {uploadingPhoto ? "מעלה..." : "צילום מהמצלמה"}
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handlePhoto(f);
            }}
          />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy || uploadingPhoto}
            className="py-3.5 rounded-xl border border-white/15 text-white font-medium"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || uploadingPhoto}
            className="py-3.5 rounded-xl bg-emerald-500 text-[#062017] font-bold disabled:opacity-60"
          >
            {busy ? "שומר..." : "אישור מסירה"}
          </button>
        </div>
      </div>
    </div>
  );
}
