"use client";

import { useState } from "react";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";

export function SalesSettingsForm({
  initial,
}: {
  initial: { featuredBadgeLabel: string; upsellSizeNudge: boolean; cartUpsellTitle: string };
}) {
  const [featuredLabel, setFeaturedLabel] = useState(initial.featuredBadgeLabel);
  const [sizeNudge, setSizeNudge] = useState(initial.upsellSizeNudge);
  const [upsellTitle, setUpsellTitle] = useState(initial.cartUpsellTitle);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  function pushToast(kind: ToastKind, message: string) {
    setToast({ id: Date.now(), kind, message });
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          featured_badge_label: featuredLabel.trim() || null,
          upsell_size_nudge: sizeNudge,
          cart_upsell_title: upsellTitle.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        pushToast("err", body?.error?.message ?? "שמירה נכשלה");
        return;
      }
      pushToast("ok", "ההגדרות נשמרו");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="space-y-5">
        <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-2xl p-4 text-sm leading-relaxed text-qf-ink2">
          הגדרות המכירות חלות על החנות וגם על הקיוסק. שאר הפיצ&apos;רים (קטגוריה של &quot;מומלץ בעגלה&quot;, תזכורת קינוח לפני סגירה, פריט &quot;מומלץ&quot;) מנוהלים מתפריט וקטגוריות בדשבורד.
        </div>

        <div className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-2">
          <label className="block text-sm font-bold">תווית &quot;מומלץ&quot; על כרטיסי מנות</label>
          <input
            value={featuredLabel}
            onChange={(e) => setFeaturedLabel(e.target.value)}
            placeholder="מומלץ של השף"
            maxLength={40}
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
          <p className="text-xs text-qf-mute">
            הטקסט שמופיע על פינת כרטיסי המנות שסימנת כ&quot;מומלץ&quot; בעורך הפריט (תפריט). השאירי ריק לברירת מחדל &quot;מומלץ של השף&quot;. דוגמאות פופולריות: &quot;הכי נמכר&quot;, &quot;חדש!&quot;, &quot;הבחירה של הבית&quot;.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-2">
          <label className="block text-sm font-bold">אפסייל בעגלה</label>
          <input
            value={upsellTitle}
            onChange={(e) => setUpsellTitle(e.target.value)}
            placeholder="מומלץ עבורך"
            maxLength={60}
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
          <p className="text-xs text-qf-mute">
            הכותרת של קרוסלת ההמלצות בעמוד העגלה. השאירו ריק לברירת המחדל.
            אילו מוצרים מופיעים שם? מסמנים קטגוריות שלמות (&quot;הצג באפסייל&quot; בעריכת קטגוריה)
            או מוצרים בודדים (&quot;להציע בעגלה&quot; בעורך המוצר) - אפשר גם וגם. בלי שום סימון,
            המערכת מזהה לבד קטגוריות שתייה וקינוחים.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-qf-line-dash p-5">
          <label className="flex items-start justify-between gap-3 cursor-pointer">
            <div className="min-w-0">
              <div className="text-sm font-bold">באנר &quot;שדרגו לגודל גדול יותר&quot;</div>
              <div className="text-xs text-qf-mute mt-1 leading-relaxed">
                מציג באנר בולט בעמוד הפריט (&quot;שדרגו ל-XL בתוספת ₪10 בלבד · שדרג&quot;) כשהלקוח בחר גודל קטן מהמקסימלי. עובד בחנות ובקיוסק. נכבה אוטומטית אם לפריט יש רק גודל אחד.
              </div>
            </div>
            <input
              type="checkbox"
              checked={sizeNudge}
              onChange={(e) => setSizeNudge(e.target.checked)}
              className="w-5 h-5 mt-0.5 shrink-0 accent-(--qf-primary)"
            />
          </label>
        </div>

      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <SettingsSaveBar saving={busy} onSave={save} />
    </>
  );
}
