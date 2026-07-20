"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toggle as SharedToggle } from "@/components/shared/Toggle";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";
import { cn } from "@/lib/cn";

interface Initial {
  showTracking: boolean;
  requireEmail: boolean;
  showAttribution: boolean;
  scheduledOrdersEnabled: boolean;
  pickupEnabled: boolean;
  cutleryEnabled: boolean;
  cutleryLabel: string;
  cutleryPrice: number;
  cutleryFreeAbove: number | null;
  tipEnabled: boolean;
}

export function CheckoutSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [showTracking, setShowTracking] = useState(initial.showTracking);
  const [requireEmail, setRequireEmail] = useState(initial.requireEmail);
  const [showAttribution, setShowAttribution] = useState(initial.showAttribution);
  const [scheduledOrdersEnabled, setScheduledOrdersEnabled] = useState(
    initial.scheduledOrdersEnabled,
  );
  const [pickupEnabled, setPickupEnabled] = useState(initial.pickupEnabled);
  const [tipEnabled, setTipEnabled] = useState(initial.tipEnabled);
  const [cutleryEnabled, setCutleryEnabled] = useState(initial.cutleryEnabled);
  const [cutleryLabel, setCutleryLabel] = useState(initial.cutleryLabel);
  const [cutleryPrice, setCutleryPrice] = useState(initial.cutleryPrice / 100);
  const [cutleryFreeAbove, setCutleryFreeAbove] = useState<string>(
    initial.cutleryFreeAbove != null ? String(initial.cutleryFreeAbove / 100) : "",
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          checkout_show_tracking: showTracking,
          checkout_require_email: requireEmail,
          checkout_show_attribution: showAttribution,
          scheduled_orders_enabled: scheduledOrdersEnabled,
          pickup_enabled: pickupEnabled,
          tip_enabled: tipEnabled,
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
        setToast({ kind: "ok", msg: "נשמר" });
        router.refresh();
      } else {
        setToast({ kind: "err", msg: "שמירה נכשלה" });
      }
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  return (
    <>
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
        label="דרוש כתובת מייל בקופה"
        description={
          requireEmail
            ? "הלקוח חייב למלא כתובת מייל כדי להשלים הזמנה."
            : "כתובת המייל לא נדרשת. חברת הסליקה (Grow / CardCom) מפיקה ושולחת את חשבונית המס, והלקוח מזין את המייל בעמוד התשלום שלה. (במסעדות עם ביקורות במייל - המייל עדיין נדרש.)"
        }
        value={requireEmail}
        onChange={setRequireEmail}
      />

      <Toggle
        label="הצג שאלת 'איך הגעת אלינו?' בקופה"
        description={
          showAttribution
            ? "הלקוח נשאל איך הגיע אליכם (וולט, גוגל, המלצה וכו') - הנתונים מזינים את דוח המקורות ב'צמיחה'. ניתן לדלג."
            : "השאלה מוסתרת מהקופה. לא ייאספו נתוני מקור הגעה מהזמנות."
        }
        value={showAttribution}
        onChange={setShowAttribution}
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

      <Toggle
        label="הצע טיפ לשליח בקופה"
        description={
          tipEnabled
            ? "בהזמנת משלוח הלקוח רואה שורת טיפ לשליח (ללא / ₪5 / ₪10 / ₪15)."
            : "שורת הטיפ לשליח מוסתרת מהקופה."
        }
        value={tipEnabled}
        onChange={setTipEnabled}
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

    </div>
      <SettingsSaveBar saving={saving} onSave={save} toast={toast} />
    </>
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
