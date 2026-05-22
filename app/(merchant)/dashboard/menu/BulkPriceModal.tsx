"use client";

import { useState } from "react";
import { IcoClose } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

type Scope = "all" | "category";
type AdjustmentType =
  | "percent_increase"
  | "percent_decrease"
  | "fixed_add"
  | "fixed_subtract"
  | "set";

const TYPE_LABELS: Record<AdjustmentType, string> = {
  percent_increase: "+%",
  percent_decrease: "−%",
  fixed_add: "+₪",
  fixed_subtract: "−₪",
  set: "=₪",
};

const TYPE_DESCRIPTIONS: Record<AdjustmentType, string> = {
  percent_increase: "העלאת מחירים באחוז",
  percent_decrease: "הורדת מחירים באחוז",
  fixed_add: "הוספת סכום קבוע",
  fixed_subtract: "הפחתת סכום קבוע",
  set: "קביעת מחיר אחיד",
};

interface Category {
  id: string;
  name: string;
}

export function BulkPriceModal({
  categories,
  onClose,
  onSuccess,
}: {
  categories: Category[];
  onClose: () => void;
  onSuccess: (updated: number) => void;
}) {
  const [scope, setScope] = useState<Scope>("all");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [type, setType] = useState<AdjustmentType>("percent_increase");
  const [value, setValue] = useState<number>(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setError(null);
    if (scope === "category" && !categoryId) {
      setError("בחר קטגוריה");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/merchant/menu/items/bulk-price", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope,
          category_id: scope === "category" ? categoryId : undefined,
          adjustment: { type, value },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "עדכון נכשל");
        return;
      }
      onSuccess(data.updated as number);
    } finally {
      setBusy(false);
    }
  }

  const previewPrice = (() => {
    const base = 100;
    switch (type) {
      case "percent_increase":
        return Math.max(0, Math.round(base * (1 + value / 100)));
      case "percent_decrease":
        return Math.max(0, Math.round(base * (1 - value / 100)));
      case "fixed_add":
        return Math.max(0, base + Math.round(value));
      case "fixed_subtract":
        return Math.max(0, base - Math.round(value));
      case "set":
        return Math.max(0, Math.round(value));
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-qf-line">
          <div>
            <h2 className="font-semibold text-lg">עדכון מחירים מרובה</h2>
            <p className="text-xs text-qf-mute mt-0.5">
              עדכן מחירים של כל הפריטים או קטגוריה שלמה בלחיצה אחת.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full grid place-items-center hover:bg-qf-line-soft"
            aria-label="סגור"
          >
            <IcoClose s={16} />
          </button>
        </header>

        <div className="p-5 space-y-5">
          {/* Scope */}
          <div>
            <label className="text-sm font-medium block mb-2">מי מקבל את העדכון?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={cn(
                  "px-4 py-3 rounded-xl border text-sm font-medium transition",
                  scope === "all"
                    ? "border-(--qf-primary) bg-(--qf-primary) text-white"
                    : "border-qf-line-dash bg-white text-qf-ink2 hover:border-qf-mute",
                )}
              >
                כל התפריט
              </button>
              <button
                type="button"
                onClick={() => setScope("category")}
                className={cn(
                  "px-4 py-3 rounded-xl border text-sm font-medium transition",
                  scope === "category"
                    ? "border-(--qf-primary) bg-(--qf-primary) text-white"
                    : "border-qf-line-dash bg-white text-qf-ink2 hover:border-qf-mute",
                )}
              >
                קטגוריה בודדת
              </button>
            </div>
            {scope === "category" && (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Adjustment type */}
          <div>
            <label className="text-sm font-medium block mb-2">סוג השינוי</label>
            <div className="grid grid-cols-5 gap-1.5">
              {(Object.keys(TYPE_LABELS) as AdjustmentType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  title={TYPE_DESCRIPTIONS[t]}
                  className={cn(
                    "py-2 rounded-lg text-sm font-bold transition",
                    type === t
                      ? "bg-qf-ink text-white"
                      : "bg-qf-line-soft text-qf-ink2 hover:bg-qf-line-dash/60",
                  )}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <p className="text-xs text-qf-mute mt-2">{TYPE_DESCRIPTIONS[type]}</p>
          </div>

          {/* Value */}
          <div>
            <label className="text-sm font-medium block mb-2">
              {type.startsWith("percent")
                ? "אחוז"
                : type === "set"
                  ? "מחיר חדש (₪)"
                  : "סכום (₪)"}
            </label>
            <div className="flex items-center border border-qf-line-dash rounded-xl focus-within:border-(--qf-primary)">
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(Math.max(0, parseFloat(e.target.value) || 0))}
                className="flex-1 px-4 py-2.5 outline-none bg-transparent tnum text-lg font-bold"
              />
              <span className="px-3 text-qf-mute font-semibold">
                {type.startsWith("percent") ? "%" : "₪"}
              </span>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-qf-line-soft/60 rounded-xl px-4 py-3 text-sm">
            <span className="text-qf-mute">דוגמה: פריט ב-₪100 יהפוך ל-</span>
            <span className="font-bold tnum text-qf-ink">₪{previewPrice}</span>
          </div>

          {error && (
            <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-qf-line bg-qf-bg/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-qf-ink2 hover:bg-qf-line-soft"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={busy}
            className="px-5 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "מעדכן..." : "החל על הפריטים"}
          </button>
        </footer>
      </div>
    </div>
  );
}
