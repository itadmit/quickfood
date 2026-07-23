"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

type Layout = "classic" | "category_grid";

const OPTIONS: Array<{ value: Layout; label: string; description: string }> = [
  {
    value: "classic",
    label: "תפריט רציף (ברירת מחדל)",
    description:
      "כל המוצרים על מסך אחד עם ניווט קטגוריות דביק - הסגנון הרגיל של החנות.",
  },
  {
    value: "category_grid",
    label: "קוביות קטגוריה",
    description:
      "מסך פתיחה של קוביות קטגוריה; לחיצה נכנסת לקטגוריה ומציגה את המוצרים ברשת. מתאים לחנויות עם קטלוג רחב (עולם החיות, סופר, פארם).",
  },
];

export function StorefrontLayoutToggle({ initial }: { initial: Layout }) {
  const router = useRouter();
  const [value, setValue] = useState<Layout>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(next: Layout) {
    if (next === value || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ storefront_layout: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "שמירת ההעדפה נכשלה");
      }
      setValue(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירת ההעדפה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2.5">
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => pick(opt.value)}
            disabled={saving}
            style={
              active
                ? {
                    borderColor: "#000",
                    backgroundColor: "#FFF6CE",
                    boxShadow: "0 3px 0 #000",
                  }
                : { borderColor: "rgba(0,0,0,0.15)", backgroundColor: "#fff" }
            }
            className={cn(
              "w-full text-start p-4 rounded-xl border-2 transition flex items-start gap-3",
              !active && "hover:border-black/40",
              saving && "opacity-60 cursor-wait",
            )}
          >
            <span
              className="mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 grid place-items-center transition"
              style={{
                borderColor: "#000",
                backgroundColor: active ? "#F8CB1E" : "#fff",
              }}
            >
              {active && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: "#000" }}
                />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-black">
                {opt.label}
              </span>
              <span className="block text-xs mt-0.5 leading-relaxed text-black/60">
                {opt.description}
              </span>
            </span>
          </button>
        );
      })}
      {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
    </div>
  );
}
