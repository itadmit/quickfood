"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function MarketingForm({ facebookPixelId }: { facebookPixelId: string }) {
  const router = useRouter();
  const [value, setValue] = useState(facebookPixelId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const trimmed = value.trim();
  const valid = trimmed === "" || /^\d{5,20}$/.test(trimmed);
  const dirty = trimmed !== facebookPixelId;

  async function save() {
    if (saving || !valid || !dirty) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facebook_pixel_id: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "השמירה נכשלה");
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-6">
      <header className="mb-4">
        <h2 className="text-lg font-bold">פיקסל פייסבוק (Meta Pixel)</h2>
        <p className="text-sm text-qf-mute mt-1 leading-relaxed">
          מחברים את הפיקסל שלכם מ-Meta ואנחנו נזריק אותו אוטומטית לחנות
          ונשלח את אירועי ההמרה: צפייה בדף, הוספה לסל, התחלת צ׳ק אאוט ורכישה
          (עם ערך ההזמנה). ככה תוכלו להריץ קמפיינים, לייעל להמרות ולעשות
          ריטרגטינג לקונים שלכם.
        </p>
      </header>

      <label className="block text-sm font-bold mb-1.5">מזהה הפיקסל</label>
      <input
        dir="ltr"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="לדוגמה: 1234567890123456"
        className={cn(
          "w-full h-12 px-4 rounded-xl border-2 text-base text-start tnum",
          valid ? "border-black/15 focus:border-black" : "border-qf-tomato",
          "outline-none transition",
        )}
      />
      {!valid && (
        <p className="text-xs text-qf-tomato font-medium mt-1.5">
          מזהה הפיקסל חייב להיות 5-20 ספרות (ללא רווחים או אותיות).
        </p>
      )}
      <p className="text-xs text-qf-mute mt-2 leading-relaxed">
        את המזהה מוצאים ב-Meta Events Manager ← Data sources ← הפיקסל שלכם
        (מספר בן 15-16 ספרות). להשארת השדה ריק - מוחקים ושומרים, והמעקב
        מכובה.
      </p>

      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving || !valid || !dirty}
          style={
            saving || !valid || !dirty
              ? { backgroundColor: "#eee", color: "#999", borderColor: "rgba(0,0,0,0.15)" }
              : { backgroundColor: "#F8CB1E", color: "#000", borderColor: "#000", boxShadow: "0 3px 0 #000" }
          }
          className={cn(
            "h-11 px-6 rounded-xl border-2 font-bold text-sm transition",
            saving && "opacity-70 cursor-wait",
          )}
        >
          {saving ? "שומר..." : "שמירה"}
        </button>
        {saved && !dirty && (
          <span className="text-sm font-bold text-qf-green">נשמר</span>
        )}
        {error && <span className="text-sm font-medium text-qf-tomato">{error}</span>}
      </div>
    </section>
  );
}
