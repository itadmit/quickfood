"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";

export function LegalTermsForm({
  slug,
  termsText,
  defaultText,
}: {
  slug: string;
  termsText: string | null;
  defaultText: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(termsText ?? defaultText);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const isCustom = text.trim() !== defaultText.trim() && text.trim().length > 0;

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
        body: JSON.stringify({ terms_text: value }),
      });
      const ok = res.ok;
      setToast(ok ? { kind: "ok", msg: "נשמר" } : { kind: "err", msg: "שמירה נכשלה" });
      if (ok) router.refresh();
    } catch {
      setToast({ kind: "err", msg: "שמירה נכשלה" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2400);
    }
  }

  return (
    <div className="space-y-5">
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
            התקנון מוצג ללקוחות בעמוד נפרד בחנות ומאושר בעת התשלום - דרישה של חברת
            הסליקה. מילאנו עבורך נוסח ברירת מחדל מלא לפי פרטי העסק (שם, ח.פ, כתובת,
            טלפון). ניתן לערוך אותו בחופשיות. אם תשאיר/י את נוסח ברירת המחדל, הוא
            יתעדכן אוטומטית כשתעדכן/י את פרטי העסק.
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
      </section>

      <SettingsSaveBar saving={saving} onSave={save} toast={toast} />
    </div>
  );
}
