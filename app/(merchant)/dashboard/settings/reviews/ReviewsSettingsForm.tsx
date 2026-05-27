"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCheck } from "@/components/shared/Icons";
import { Toggle as SharedToggle } from "@/components/shared/Toggle";
import { cn } from "@/lib/cn";

type Channel = "off" | "email" | "sms" | "whatsapp";

interface Initial {
  enabled: boolean;
  public: boolean;
  channel: Channel;
  delayMinutes: number;
  smsSender: string;
}

export function ReviewsSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [v, setV] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Initial>(k: K, val: Initial[K]) {
    setV((x) => ({ ...x, [k]: val }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/settings/reviews", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: v.enabled,
          public: v.public,
          channel: v.channel,
          delay_minutes: v.delayMinutes,
          sms_sender: v.smsSender.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "שמירה נכשלה");
        return;
      }
      setToast("נשמר");
      router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  const disabled = !v.enabled;

  return (
    <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-5">
      <Toggle
        label="הפעל ביקורות"
        description="כשמכובה, לקוחות לא יוכלו להגיש דירוג ולא יישלחו תזכורות"
        value={v.enabled}
        onChange={(b) => set("enabled", b)}
      />

      <div
        className={cn(
          "space-y-5 transition-opacity",
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        <Toggle
          label="הצג ביקורות ללקוחות"
          description="כשמופעל, יופיע עמוד ביקורות ציבורי לעסק שלך"
          value={v.public}
          onChange={(b) => set("public", b)}
        />

        <div className="space-y-2">
          <div className="text-sm font-medium">ערוץ שליחת בקשת דירוג</div>
          <p className="text-xs text-qf-mute">
            תישלח תזכורת אוטומטית ללקוח אחרי שההזמנה נמסרה
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                { val: "off", label: "כבוי" },
                { val: "email", label: "מייל" },
                { val: "sms", label: "SMS" },
                { val: "whatsapp", label: "WhatsApp" },
              ] as Array<{ val: Channel; label: string }>
            ).map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => set("channel", opt.val)}
                className={cn(
                  "py-2.5 rounded-xl border text-sm font-medium transition",
                  v.channel === opt.val
                    ? "border-(--qf-primary) bg-qf-green-soft text-(--qf-deep)"
                    : "border-qf-line-dash text-qf-ink2 hover:border-qf-line",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {v.channel === "email" && (
            <p className="text-xs text-qf-mute mt-1">
              כשבחור מייל, שדה אימייל יהפוך לחובה בצ׳קאאוט.
            </p>
          )}
          {v.channel === "whatsapp" && (
            <p className="text-xs text-qf-mute mt-1">
              דורש חיבור WhatsApp פעיל (iBot Chat) בלשונית WhatsApp.
            </p>
          )}
        </div>

        <div
          className={cn(
            "grid grid-cols-1 sm:grid-cols-2 gap-3",
            v.channel === "off" && "opacity-60 pointer-events-none",
          )}
        >
          <Field
            label="זמן השהיה לפני שליחה (דקות)"
            hint="ברירת מחדל 60 דקות אחרי שההזמנה נמסרה"
          >
            <input
              type="number"
              min={5}
              max={1440}
              value={v.delayMinutes}
              onChange={(e) =>
                set("delayMinutes", Math.max(5, Math.min(1440, parseInt(e.target.value, 10) || 60)))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum"
            />
          </Field>
          <Field
            label="שם השולח ב-SMS"
            hint="עד 11 תווים באנגלית/ספרות (דרישת ספק)"
          >
            <input
              value={v.smsSender}
              onChange={(e) => set("smsSender", e.target.value.slice(0, 11))}
              maxLength={11}
              dir="ltr"
              placeholder="QuickFood"
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-qf-line-soft">
        <div className="text-sm">
          {toast && (
            <span className="inline-flex items-center gap-1.5 text-qf-green-deep">
              <IcoCheck c="currentColor" s={14} />
              {toast}
            </span>
          )}
          {error && <span className="text-qf-tomato">{error}</span>}
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">{label}</label>
      {children}
      {hint && <div className="text-xs text-qf-mute">{hint}</div>}
    </div>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <span className="mt-0.5">
        <SharedToggle checked={value} onChange={onChange} aria-label={label} />
      </span>
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-qf-mute mt-0.5">{description}</div>
      </div>
    </label>
  );
}
