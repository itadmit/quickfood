"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toggle } from "@/components/shared/Toggle";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";

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
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

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
      setToast(res.ok ? { kind: "ok", msg: "נשמר" } : { kind: "err", msg: "שמירה נכשלה" });
      if (res.ok) router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
        {/* Column headers only where the columns actually line up; the mobile
            layout wraps the inputs onto their own row and labels them inline. */}
        <div className="hidden sm:grid grid-cols-[1fr_120px_120px_100px] gap-x-3 items-center pb-2 mb-2 border-b border-qf-line-soft text-xs font-medium text-qf-mute">
          <div>יום</div>
          <div>שעת פתיחה</div>
          <div>שעת סגירה</div>
          <div />
        </div>
        <div className="divide-y divide-qf-line-soft sm:divide-y-0 sm:space-y-2">
          {DAYS.map((d) => {
            const h = hours[d.key];
            return (
              <div
                key={d.key}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_120px_100px] gap-x-3 gap-y-2 items-center py-3 sm:py-1.5"
              >
                <div className="font-medium text-sm">{d.label}</div>
                <label className="inline-flex items-center gap-2 text-sm sm:order-last">
                  <Toggle
                    checked={h.active}
                    onChange={(next) => setDay(d.key, { active: next })}
                    aria-label={`${d.label} ${h.active ? "פתוח" : "סגור"}`}
                  />
                  <span className="text-xs text-qf-mute">{h.active ? "פתוח" : "סגור"}</span>
                </label>
                <div className="col-start-1 sm:col-auto">
                  <span className="block sm:hidden text-[10px] text-qf-mute mb-0.5">
                    שעת פתיחה
                  </span>
                  <input
                    type="time"
                    aria-label={`${d.label} · שעת פתיחה`}
                    value={h.open}
                    onChange={(e) => setDay(d.key, { open: e.target.value })}
                    disabled={!h.active}
                    className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm disabled:opacity-50"
                  />
                </div>
                <div>
                  <span className="block sm:hidden text-[10px] text-qf-mute mb-0.5">
                    שעת סגירה
                  </span>
                  <input
                    type="time"
                    aria-label={`${d.label} · שעת סגירה`}
                    value={h.close}
                    onChange={(e) => setDay(d.key, { close: e.target.value })}
                    disabled={!h.active}
                    className="w-full px-2.5 py-2 rounded-lg border border-qf-line-dash text-sm disabled:opacity-50"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <SettingsSaveBar saving={saving} onSave={save} toast={toast} />
    </>
  );
}
