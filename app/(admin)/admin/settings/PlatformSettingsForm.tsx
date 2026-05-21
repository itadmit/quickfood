"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCheck } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

interface Initial {
  whatsappDefaultToken: string;
  whatsappDefaultInstanceId: string;
}

export function PlatformSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [v, setV] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [testPhone, setTestPhone] = useState("");
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: true } | { ok: false; message: string } | null
  >(null);

  function set<K extends keyof Initial>(k: K, val: Initial[K]) {
    setV((x) => ({ ...x, [k]: val }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const res = await fetch("/api/v1/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          whatsapp_default_token: v.whatsappDefaultToken.trim() || null,
          whatsapp_default_instance_id:
            v.whatsappDefaultInstanceId.trim() || null,
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
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function sendTest() {
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/admin/settings/whatsapp/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: testPhone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestResult({
          ok: false,
          message: data?.error?.message ?? "שליחה נכשלה",
        });
        return;
      }
      if (data.ok) {
        setTestResult({ ok: true });
      } else {
        setTestResult({
          ok: false,
          message: data.message || "iBot החזיר כישלון. בדוק את ה-Token וה-Instance.",
        });
      }
    } catch {
      setTestResult({ ok: false, message: "שגיאת רשת" });
    } finally {
      setTestBusy(false);
    }
  }

  const configured = !!initial.whatsappDefaultToken && !!initial.whatsappDefaultInstanceId;
  const canTest = configured && !testBusy && testPhone.trim().length >= 9;

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4 max-w-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">
              WhatsApp (iBot Chat) — ברירת מחדל
            </h2>
            <p className="text-xs lg:text-sm text-qf-mute mt-0.5">
              כאן נכנסים פרטי חשבון iBot של QuickFood. שולחים מכאן אם המסעדה
              לא הזינה לעצמה Token + Instance ID בהגדרות שלה. אם המסעדה כן
              הזינה, שלה גוברים (היא שולחת מהמספר WhatsApp שלה).
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5",
              configured
                ? "bg-qf-green-soft text-qf-green-deep"
                : "bg-qf-line-soft text-qf-mute",
            )}
          >
            {configured ? "פעיל" : "לא מוגדר"}
          </span>
        </div>

        <Field label="Token (API key / Instance JWT)">
          <input
            value={v.whatsappDefaultToken}
            onChange={(e) => set("whatsappDefaultToken", e.target.value)}
            dir="ltr"
            placeholder="eyJhbGciOi..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
          />
        </Field>

        <Field label="Instance ID / Client ID">
          <input
            value={v.whatsappDefaultInstanceId}
            onChange={(e) => set("whatsappDefaultInstanceId", e.target.value)}
            dir="ltr"
            placeholder="abc123-instance"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
          />
        </Field>

        <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-xs text-qf-ink2">
          לתשומת לב: כשמסעדה נשלחת עם פרטי ה-fallback, ההודעה תצא מ-WhatsApp
          של QuickFood (לא מהמספר שלה). יתרת ההודעות עדיין מנוכה מהמסעדה.
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
            className="px-4 py-2 rounded-xl bg-qf-ink text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? "שומר..." : "שמירת שינויים"}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3 max-w-2xl">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">בדיקת חיבור</h2>
          <p className="text-xs lg:text-sm text-qf-mute">
            שליחת הודעת בדיקה דרך פרטי ה-fallback. לא מנוכה משום מסעדה ולא נרשם בלוג ההיסטוריה.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="tel"
            inputMode="tel"
            dir="ltr"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="050-1234567"
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none tnum text-sm"
          />
          <button
            type="button"
            onClick={sendTest}
            disabled={!canTest}
            className="px-4 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {testBusy ? "שולח..." : "שליחת בדיקה"}
          </button>
        </div>
        {!configured && (
          <div className="text-xs text-qf-mute">
            שמור Token + Instance ID לפני שליחת בדיקה.
          </div>
        )}
        {testResult && (
          <div
            className={cn(
              "text-sm rounded-xl px-3 py-2 border",
              testResult.ok
                ? "bg-qf-green-soft border-(--qf-primary)/30 text-qf-green-deep"
                : "bg-qf-tomato-soft border-qf-tomato/40 text-qf-tomato",
            )}
          >
            {testResult.ok
              ? "הודעת הבדיקה נשלחה. בדוק/י את ה-WhatsApp."
              : testResult.message}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">{label}</label>
      {children}
    </div>
  );
}
