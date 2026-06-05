"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCheck } from "@/components/shared/Icons";
import { Toggle as SharedToggle } from "@/components/shared/Toggle";
import { cn } from "@/lib/cn";

interface Initial {
  showTracking: boolean;
  scheduledOrdersEnabled: boolean;
  pickupEnabled: boolean;
  cutleryEnabled: boolean;
  cutleryLabel: string;
  cutleryPrice: number;
  cutleryFreeAbove: number | null;
}

export function CheckoutSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [showTracking, setShowTracking] = useState(initial.showTracking);
  const [scheduledOrdersEnabled, setScheduledOrdersEnabled] = useState(
    initial.scheduledOrdersEnabled,
  );
  const [pickupEnabled, setPickupEnabled] = useState(initial.pickupEnabled);
  const [cutleryEnabled, setCutleryEnabled] = useState(initial.cutleryEnabled);
  const [cutleryLabel, setCutleryLabel] = useState(initial.cutleryLabel);
  const [cutleryPrice, setCutleryPrice] = useState(initial.cutleryPrice / 100);
  const [cutleryFreeAbove, setCutleryFreeAbove] = useState<string>(
    initial.cutleryFreeAbove != null ? String(initial.cutleryFreeAbove / 100) : "",
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
          pickup_enabled: pickupEnabled,
          cutlery_enabled: cutleryEnabled,
          cutlery_label: cutleryLabel.trim() || "סכו״ם חד״פ",
          cutlery_price: Math.max(0, Math.round(Number(cutleryPrice) * 100) || 0),
          cutlery_free_above:
            cutleryFreeAbove.trim() === ""
              ? null
              : Math.max(0, Math.round(Number(cutleryFreeAbove) * 100) || 0),
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
    <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-5">
      <Toggle
        label="הצג מעקב הזמנה בעמוד התודה"
        description={
          showTracking
            ? "הלקוח רואה זמן הגעה משוער, סטטוס חי, וקו זמן של ההזמנה אחרי התשלום."
            : "אחרי התשלום הלקוח רואה רק קבלה - כמו חנות אונליין רגילה."
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

      <Toggle
        label="אפשר ללקוח להזמין לאיסוף עצמי"
        description={
          pickupEnabled
            ? "הלקוח יכול לבחור איסוף עצמי מהסניף בנוסף למשלוח."
            : "החנות מציעה רק משלוחים. לחיצה על 'איסוף עצמי' תפתח את בורר הכתובת."
        }
        value={pickupEnabled}
        onChange={setPickupEnabled}
      />

      <div className="pt-3 border-t border-qf-line-soft space-y-4">
        <Toggle
          label="הצע ללקוח להוסיף סכו״ם חד״פ"
          description={
            cutleryEnabled
              ? "בקופה הלקוח רואה טוגל וסטפר לבחירת מספר סטים."
              : "לא יוצג ללקוח. הזמנות לא יכללו סכו״ם חד״פ."
          }
          value={cutleryEnabled}
          onChange={setCutleryEnabled}
        />

        {cutleryEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 ms-9">
            <div>
              <label className="text-xs font-medium block mb-1">תווית להצגה</label>
              <input
                type="text"
                value={cutleryLabel}
                maxLength={60}
                onChange={(e) => setCutleryLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">מחיר לסט (₪)</label>
              <input
                type="number"
                min={0}
                step={0.5}
                value={cutleryPrice}
                onChange={(e) => setCutleryPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm tnum"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">חינם מעל הזמנה (₪, אופציונלי)</label>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="-"
                value={cutleryFreeAbove}
                onChange={(e) => setCutleryFreeAbove(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm tnum"
              />
            </div>
          </div>
        )}
      </div>

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
