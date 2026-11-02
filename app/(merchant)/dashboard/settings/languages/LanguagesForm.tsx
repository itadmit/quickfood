"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

type Extra = "en" | "ru";

const EXTRAS: Array<{ code: Extra; label: string; native: string }> = [
  { code: "en", label: "אנגלית", native: "English" },
  { code: "ru", label: "רוסית", native: "Русский" },
];

export function LanguagesForm({ enabled }: { enabled: string[] }) {
  const router = useRouter();
  const [on, setOn] = useState<Record<Extra, boolean>>({
    en: enabled.includes("en"),
    ru: enabled.includes("ru"),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(code: Extra) {
    setOn((s) => ({ ...s, [code]: !s[code] }));
    setSaved(false);
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const langs = ["he", ...EXTRAS.filter((e) => on[e.code]).map((e) => e.code)];
    try {
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storefront_languages: langs }),
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
        <h2 className="text-lg font-bold">שפות החנות</h2>
        <p className="text-sm text-qf-mute mt-1 leading-relaxed">
          עברית היא שפת ברירת המחדל ותמיד פעילה. כל שפה שתדליקו כאן תוסיף ללקוח
          מתג שפה (גלובוס) בחזית החנות — התפריט מתורגם אוטומטית, והכיוון מתהפך
          ל-LTR באנגלית/רוסית. חנות שלא מדליקה שפות נוספות לא משתנה כלל.
        </p>
      </header>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between p-4 rounded-xl border-2 border-black/10 bg-qf-bg">
          <div>
            <span className="block text-sm font-bold text-black">עברית · Hebrew</span>
            <span className="block text-xs text-qf-mute mt-0.5">ברירת מחדל — תמיד פעילה</span>
          </div>
          <span className="text-xs font-bold text-qf-green">פעיל</span>
        </div>

        {EXTRAS.map((e) => {
          const active = on[e.code];
          return (
            <button
              key={e.code}
              type="button"
              onClick={() => toggle(e.code)}
              style={
                active
                  ? { borderColor: "#000", backgroundColor: "#FFF6CE", boxShadow: "0 3px 0 #000" }
                  : { borderColor: "rgba(0,0,0,0.15)", backgroundColor: "#fff" }
              }
              className="w-full flex items-center justify-between p-4 rounded-xl border-2 transition text-start"
            >
              <span>
                <span className="block text-sm font-bold text-black">
                  {e.label} · {e.native}
                </span>
              </span>
              <span
                className={cn(
                  "w-11 h-6 rounded-full relative transition shrink-0",
                  active ? "bg-qf-green" : "bg-black/15",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                    active ? "inset-s-5" : "inset-s-0.5",
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{ backgroundColor: "#F8CB1E", color: "#000", borderColor: "#000", boxShadow: "0 3px 0 #000" }}
          className={cn("h-11 px-6 rounded-xl border-2 font-bold text-sm transition", saving && "opacity-70 cursor-wait")}
        >
          {saving ? "שומר..." : "שמירה"}
        </button>
        {saved && <span className="text-sm font-bold text-qf-green">נשמר</span>}
        {error && <span className="text-sm font-medium text-qf-tomato">{error}</span>}
      </div>
    </section>
  );
}
