"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
}

export function LegalTermsForm({
  slug,
  termsText,
  defaultText,
  acknowledgedAt,
}: {
  slug: string;
  termsText: string | null;
  defaultText: string;
  acknowledgedAt: string | null;
}) {
  const router = useRouter();
  const [text, setText] = useState(termsText ?? defaultText);
  const [ackChecked, setAckChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const isCustom = text.trim() !== defaultText.trim() && text.trim().length > 0;
  const needsAck = !acknowledgedAt;
  const blocked = needsAck && !ackChecked;

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      // When the merchant leaves the default untouched (or empties it) we
      // store null - the storefront then keeps auto-generating, so the page
      // stays in sync with the business details going forward.
      const value =
        !text.trim() || text.trim() === defaultText.trim() ? null : text;
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          terms_text: value,
          // First approval stamps termsAcknowledgedAt and clears the
          // dashboard gate. Later saves just update the text.
          ...(needsAck ? { terms_acknowledged: true } : {}),
        }),
      });
      const ok = res.ok;
      setToast(
        ok
          ? { kind: "ok", msg: needsAck ? "התקנון אושר ונשמר" : "נשמר" }
          : { kind: "err", msg: "שמירה נכשלה" },
      );
      if (ok) router.refresh();
    } catch {
      setToast({ kind: "err", msg: "שמירה נכשלה" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2600);
    }
  }

  return (
    <div className="space-y-5">
      {/* Liability disclaimer - the merchant owns the content. */}
      <div className="rounded-2xl border border-qf-yolk/50 bg-qf-yolk-soft/50 p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-qf-ink2 shrink-0 mt-0.5" />
        <p className="text-sm text-qf-ink2 leading-relaxed">
          הכנו עבורך נוסח תקנון אוטומטי לפי פרטי העסק (שם, ח.פ, כתובת, טלפון).{" "}
          <span className="font-semibold text-qf-ink">
            האחריות המלאה לתוכן התקנון היא עליך
          </span>{" "}
          - עליך לעבור עליו, להתאים אותו לפעילות העסק שלך ולוודא שהוא עומד בדרישות
          הדין. QuickFood מספקת נוסח בסיס בלבד ואינה אחראית לתוכן התקנון או לתקינותו
          המשפטית.
        </p>
      </div>

      {acknowledgedAt && (
        <div className="rounded-2xl border border-qf-green-deep/20 bg-qf-green-soft p-3.5 flex items-center gap-2.5 text-sm text-qf-green-deep font-medium">
          <ShieldCheck size={18} className="shrink-0" />
          אישרת את התקנון בתאריך {formatDate(acknowledgedAt)}
        </div>
      )}

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
        <header className="space-y-1">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-bold text-lg">תקנון ותנאי שימוש</h2>
            <a
              href={`/s/${slug}/terms`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-(--qf-deep) underline underline-offset-2"
            >
              תצוגה בחנות
            </a>
          </div>
          <p className="text-xs text-qf-mute leading-relaxed">
            התקנון מוצג ללקוחות בעמוד נפרד בחנות ומאושר בעת התשלום. אם תשאיר/י את
            נוסח ברירת המחדל, הוא יתעדכן אוטומטית כשתעדכן/י את פרטי העסק.
          </p>
          <p className="text-xs font-medium">
            {isCustom ? (
              <span className="text-(--qf-deep)">נוסח מותאם אישית</span>
            ) : (
              <span className="text-qf-mute">נוסח ברירת מחדל (אוטומטי)</span>
            )}
          </p>
        </header>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={22}
          dir="rtl"
          className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none resize-y text-sm leading-relaxed font-mono"
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setText(defaultText)}
            className="text-sm font-medium text-qf-ink2 hover:text-qf-ink underline underline-offset-2"
          >
            שחזר לנוסח ברירת המחדל
          </button>
          <p className="text-xs text-qf-mute">
            כותרות: שורה שמתחילה ב-## · רשימה: שורה שמתחילה ב-־
          </p>
        </div>

        {needsAck && (
          <label className="flex items-start gap-2.5 rounded-xl border border-qf-line-dash bg-qf-bg/40 p-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={ackChecked}
              onChange={(e) => setAckChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 shrink-0 accent-(--qf-primary)"
            />
            <span className="text-sm text-qf-ink2 leading-relaxed">
              קראתי את התקנון, התאמתי אותו לפעילות העסק, ואני מאשר/ת שאני האחראי/ת
              הבלעדי/ת לתוכנו ולתקינותו המשפטית.
            </span>
          </label>
        )}
      </section>

      <SettingsSaveBar saving={saving} onSave={save} toast={toast} disabled={blocked} />
    </div>
  );
}
