"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { IcoCheck } from "@/components/shared/Icons";

type DayHours = { open: string; close: string; active: boolean };

const DAYS = [
  { key: "sunday", label: "יום ראשון" },
  { key: "monday", label: "יום שני" },
  { key: "tuesday", label: "יום שלישי" },
  { key: "wednesday", label: "יום רביעי" },
  { key: "thursday", label: "יום חמישי" },
  { key: "friday", label: "יום שישי" },
  { key: "saturday", label: "שבת" },
];

const DEFAULT: DayHours = { open: "11:00", close: "23:00", active: true };

export function HoursForm({
  branchId,
  initialHours,
}: {
  branchId: string;
  initialHours: Record<string, DayHours>;
}) {
  const router = useRouter();
  const [hours, setHours] = useState<Record<string, DayHours>>(() => {
    const out: Record<string, DayHours> = {};
    for (const d of DAYS) out[d.key] = initialHours[d.key] ?? DEFAULT;
    return out;
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function setDay(key: string, patch: Partial<DayHours>) {
    setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }));
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch(`/api/v1/merchant/branches/${branchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      setToast(res.ok ? "נשמר" : "שמירה נכשלה");
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-qf-line-dash p-5">
      <div className="space-y-2">
        {DAYS.map((d) => {
          const h = hours[d.key];
          return (
            <div key={d.key} className="grid grid-cols-[1fr_120px_120px_100px] gap-3 items-center py-1.5">
              <div className="font-medium text-sm">{d.label}</div>
              <input
                type="time"
                value={h.open}
                onChange={(e) => setDay(d.key, { open: e.target.value })}
                disabled={!h.active}
                className="px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm disabled:opacity-50"
              />
              <input
                type="time"
                value={h.close}
                onChange={(e) => setDay(d.key, { close: e.target.value })}
                disabled={!h.active}
                className="px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm disabled:opacity-50"
              />
              <label className="inline-flex items-center gap-2 text-sm">
                <button
                  type="button"
                  role="switch"
                  aria-checked={h.active}
                  onClick={() => setDay(d.key, { active: !h.active })}
                  className={cn(
                    "relative inline-flex h-5 w-9 rounded-full transition",
                    h.active ? "bg-(--qf-primary)" : "bg-qf-line-dash",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                      h.active ? "inset-e-0.5" : "inset-s-0.5",
                    )}
                  />
                </button>
                <span className="text-xs text-qf-mute">{h.active ? "פתוח" : "סגור"}</span>
              </label>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4 mt-2 border-t border-qf-line-soft">
        <div className="text-sm text-qf-mute">
          {toast && (
            <span className="inline-flex items-center gap-1.5 text-qf-green-deep">
              <IcoCheck c="currentColor" s={14} />
              {toast}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
        >
          {saving ? "שומר..." : "שמירת שינויים"}
        </button>
      </div>
    </div>
  );
}
