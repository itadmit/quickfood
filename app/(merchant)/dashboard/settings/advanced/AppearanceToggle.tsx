"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

type Version = "v1" | "v2";

const OPTIONS: Array<{ value: Version; label: string; description: string }> = [
  {
    value: "v2",
    label: "ניראות חדשה (ברירת מחדל)",
    description:
      "סגנון אתר הבית — צהוב/שחור, מסגרות בולטות, צללים קשיחים.",
  },
  {
    value: "v1",
    label: "ניראות קלאסית",
    description:
      "הדשבורד המקורי — רקע אפרפר, גוונים שקטים, ממשק רגיל.",
  },
];

export function AppearanceToggle({ initial }: { initial: Version }) {
  const router = useRouter();
  const [value, setValue] = useState<Version>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(next: Version) {
    if (next === value || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dashboard_version: next }),
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
            // Explicit hex (#F8CB1E / #000) instead of design tokens so
            // selection state reads clearly on both V1 (slate) and V2
            // (cream) shells — and so the toggle that lets the merchant
            // *leave* V2 still looks right while standing inside V2.
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
      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
}
