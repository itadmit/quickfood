"use client";

import { useState } from "react";
import { Toast, type ToastState, type ToastKind } from "@/components/shared/Toast";

export function KioskSettingsForm({
  slug,
  enabled,
  initial,
}: {
  slug: string;
  enabled: boolean;
  initial: { welcomeText: string; idleSeconds: number; requirePhone: boolean };
}) {
  const [welcomeText, setWelcomeText] = useState(initial.welcomeText);
  const [idleSeconds, setIdleSeconds] = useState(initial.idleSeconds);
  const [requirePhone, setRequirePhone] = useState(initial.requirePhone);
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
          kiosk_welcome_text: welcomeText.trim() || null,
          kiosk_idle_seconds: Math.max(15, Math.min(600, idleSeconds)),
          kiosk_require_phone: requirePhone,
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

  if (!enabled) {
    return (
      <div className="bg-white border-2 border-dashed border-qf-line-dash rounded-2xl p-8 text-center space-y-3">
        <h2 className="text-lg font-bold">קיוסק להזמנה עצמית — תוסף בתשלום</h2>
        <p className="text-sm text-qf-mute leading-relaxed max-w-xl mx-auto">
          קיוסק על טאבלט בכניסה לעסק שמאפשר ללקוחות להזמין לבד — אותו תפריט, אותו עיצוב כמו האתר שלך, עם איפוס אוטומטי כשהלקוח עוזב. תשלום בקופה (או דרך מסופון מחובר — נוסיף בהמשך).
        </p>
        <p className="text-xs text-qf-mute">
          רוצה לנסות? פני אלינו ב-WhatsApp ונפעיל את התוסף לחנות שלך.
        </p>
      </div>
    );
  }

  const kioskUrl = `/s/${slug}/kiosk`;

  return (
    <>
      <div className="space-y-4">
        <div className="bg-qf-green-soft border border-qf-green/40 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-bold text-qf-green-deep">הקיוסק פעיל</div>
              <div className="text-sm text-qf-ink2 mt-0.5">
                פתחי את הכתובת הבאה על הטאבלט בעסק:
              </div>
            </div>
            <a
              href={kioskUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium"
            >
              פתח קיוסק בלשונית חדשה
            </a>
          </div>
          <code
            dir="ltr"
            className="block mt-3 text-xs bg-white border border-qf-line-dash rounded-lg p-2 font-mono"
          >
            {typeof window !== "undefined" ? window.location.origin : ""}
            {kioskUrl}
          </code>
        </div>

        <div className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1.5">טקסט פתיחה</label>
            <input
              value={welcomeText}
              onChange={(e) => setWelcomeText(e.target.value)}
              placeholder="ברוכים הבאים ל..."
              maxLength={160}
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none"
            />
            <p className="text-xs text-qf-mute mt-1">
              מופיע במסך הפתיחה של הקיוסק מעל הכפתור הראשי. ריק → ייכתב &quot;ברוכים הבאים ל-X&quot; אוטומטית.
            </p>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl border border-qf-line-dash bg-qf-line-soft/30">
            <input
              id="kiosk-require-phone"
              type="checkbox"
              checked={requirePhone}
              onChange={(e) => setRequirePhone(e.target.checked)}
              className="mt-1 w-5 h-5 accent-(--qf-primary)"
            />
            <label htmlFor="kiosk-require-phone" className="flex-1 cursor-pointer">
              <div className="text-sm font-bold">חובה למלא טלפון ושם</div>
              <div className="text-xs text-qf-mute mt-0.5 leading-relaxed">
                לפני הזמנה הלקוח מזין טלפון, ולפני תשלום מאשר את שמו. נשלח לו חשבונית בוואטסאפ או אסמס, ונקשר את ההזמנה ללקוח קיים אם יש (לפי הטלפון). מומלץ כשאתם רוצים לקרוא ללקוח בשם כשההזמנה מוכנה.
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-bold mb-1.5">איפוס אחרי חוסר פעילות (שניות)</label>
            <input
              type="number"
              value={idleSeconds}
              onChange={(e) => setIdleSeconds(parseInt(e.target.value) || 90)}
              min={15}
              max={600}
              className="w-32 px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum text-center"
            />
            <p className="text-xs text-qf-mute mt-1">
              כשהלקוח מסיים — או נטש באמצע — הקיוסק חוזר למסך הפתיחה ומנקה את הסל אחרי X שניות. 60-120 ברירת מחדל סבירה.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-bold disabled:opacity-60"
            >
              {busy ? "שומר..." : "שמירה"}
            </button>
          </div>
        </div>

        <a
          href="/dashboard/settings/kiosk/strings"
          className="block bg-white border border-qf-line-dash hover:border-(--qf-primary)/40 rounded-2xl p-5 transition group"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-qf-ink">טקסטים מותאמים</div>
              <div className="text-sm text-qf-mute mt-0.5 leading-relaxed">
                שינוי המלל בקיוסק — כותרות, הוראות, כפתורים. ברירת המחדל
                נשמרת כשהשדה נשאר ריק.
              </div>
            </div>
            <span className="text-(--qf-primary) text-sm font-bold whitespace-nowrap group-hover:translate-x-[-3px] transition">
              עריכה ←
            </span>
          </div>
        </a>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
