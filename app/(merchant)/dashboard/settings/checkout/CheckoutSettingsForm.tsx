"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCheck } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

interface Initial {
  showTracking: boolean;
  scheduledOrdersEnabled: boolean;
}

export function CheckoutSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [showTracking, setShowTracking] = useState(initial.showTracking);
  const [scheduledOrdersEnabled, setScheduledOrdersEnabled] = useState(
    initial.scheduledOrdersEnabled,
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkout_show_tracking: showTracking,
          scheduled_orders_enabled: scheduledOrdersEnabled,
        }),
      });
      if (res.ok) {
        setToast("נשמר");
        router.refresh();
      } else {
        setToast("שמירה נכשלה");
      }
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-5 max-w-2xl">
      <Toggle
        label="הצג מעקב הזמנה בעמוד התודה"
        description={
          showTracking
            ? "הלקוח רואה זמן הגעה משוער, סטטוס חי, וקו זמן של ההזמנה אחרי התשלום."
            : "אחרי התשלום הלקוח רואה רק קבלה — כמו חנות אונליין רגילה."
        }
        value={showTracking}
        onChange={setShowTracking}
      />

      <Toggle
        label="אפשר ללקוח לתזמן הזמנה לזמן מאוחר יותר"
        description={
          scheduledOrdersEnabled
            ? "הלקוח יכול לבחור שעת מסירה/איסוף ספציפית במקום 'בהקדם האפשרי'."
            : "כל ההזמנות נכנסות מיד למטבח. שדה תזמון מוסתר מהקופה."
        }
        value={scheduledOrdersEnabled}
        onChange={setScheduledOrdersEnabled}
      />

      <div className="flex items-center justify-between pt-3 border-t border-qf-line-soft">
        <div className="text-sm">
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
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          "mt-0.5 relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition",
          value ? "bg-(--qf-primary)" : "bg-qf-line",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
            value ? "translate-x-[-1.25rem]" : "translate-x-[-0.125rem]",
          )}
        />
      </button>
      <div className="flex-1">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-qf-mute mt-0.5">{description}</div>
      </div>
    </label>
  );
}
