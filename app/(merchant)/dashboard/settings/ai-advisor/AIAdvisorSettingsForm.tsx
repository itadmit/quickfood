"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCheck } from "@/components/shared/Icons";
import { Toggle } from "@/components/shared/Toggle";
import { cn } from "@/lib/cn";

interface Initial {
  enabled: boolean;
  hasKey: boolean;
  maskedKey: string | null;
}

export function AIAdvisorSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [hasKey, setHasKey] = useState(initial.hasKey);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: true } | { ok: false; message: string } | null
  >(null);

  async function save() {
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const payload: { enabled?: boolean; api_key?: string | null } = {
        enabled,
      };
      if (keyInput.trim().length > 0) payload.api_key = keyInput.trim();

      const res = await fetch("/api/v1/merchant/ai/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "שמירה נכשלה");
        return;
      }
      setKeyInput("");
      setHasKey(data.settings?.has_key ?? false);
      setToast("נשמר");
      router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  async function removeKey() {
    if (!confirm("למחוק את מפתח Gemini? היועץ ייכבה אוטומטית.")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/merchant/ai/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: null }),
      });
      if (res.ok) {
        setEnabled(false);
        setHasKey(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function testKey() {
    setTestBusy(true);
    setTestResult(null);
    try {
      const body = keyInput.trim().length > 0 ? { api_key: keyInput.trim() } : {};
      const res = await fetch("/api/v1/merchant/ai/test-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestResult({ ok: false, message: data?.error?.message ?? "בדיקה נכשלה" });
        return;
      }
      setTestResult({ ok: true });
    } finally {
      setTestBusy(false);
    }
  }

  const canTest = !testBusy && (keyInput.trim().length >= 10 || hasKey);

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">יועץ AI ללקוחות</h2>
            <p className="text-xs lg:text-sm text-qf-mute mt-0.5 leading-relaxed">
              עוזר מבוסס Google Gemini שמופיע כפתור-צף בחנות שלך. הלקוח יכול לתאר מה בא לו, היועץ ממליץ מהתפריט, ומציע פריט מותאם להוספה לעגלה — כולל מידה ותוספות לפי ההגבלות.
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5",
              enabled && hasKey
                ? "bg-qf-green-soft text-qf-green-deep"
                : "bg-qf-line-soft text-qf-mute",
            )}
          >
            {enabled && hasKey ? "פעיל" : "כבוי"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <div className="font-medium text-sm">הצג כפתור יועץ בחנות</div>
            <div className="text-xs text-qf-mute">דורש מפתח Gemini תקין.</div>
          </div>
          <Toggle
            checked={enabled}
            onChange={(v) => setEnabled(v)}
            disabled={!hasKey && !keyInput.trim()}
          />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">מפתח Google Gemini</h2>
          <p className="text-xs lg:text-sm text-qf-mute mt-0.5 leading-relaxed">
            כל חנות מחברת מפתח משלה. אנו משתמשים במודל <code dir="ltr">gemini-2.5-flash</code> שזמין ב-<strong>שכבת חינם</strong> של Google AI Studio (כ-1,500 בקשות ביום, 15 בדקה).
          </p>
        </div>

        <ol className="text-xs lg:text-sm text-qf-ink2 leading-relaxed list-decimal pr-5 space-y-1.5 bg-qf-yolk-soft/40 border border-qf-yolk/30 rounded-xl p-3">
          <li>
            כנסו ל-
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-(--qf-primary) underline font-medium mx-1"
            >
              Google AI Studio
            </a>
            והתחברו עם חשבון Google.
          </li>
          <li>לחצו <em>Create API key</em> ובחרו פרויקט (או צרו חדש).</li>
          <li>העתיקו את המפתח שמתחיל ב-<code dir="ltr">AIza…</code> והדביקו אותו כאן.</li>
          <li>לחצו <em>בדוק חיבור</em> ואז <em>שמירה</em>, ולבסוף הפעילו את הטוגל.</li>
        </ol>

        <div className="text-xs text-qf-mute leading-relaxed bg-qf-line-soft rounded-xl px-3 py-2">
          <strong>שימו לב:</strong> אם הגעתם למכסה ב-AI Studio (תופיע הודעת "Quota exceeded"), המתינו דקה או שדרגו לחשבון בתשלום ב-Google. אנו לא גובים תשלום נוסף — אתם משלמים ישירות ל-Google אם תעברו את החינם.
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium block">מפתח API</label>
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            dir="ltr"
            placeholder={hasKey ? (initial.maskedKey ?? "•••••") : "AIzaSy..."}
            type="password"
            autoComplete="off"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm font-mono"
          />
          {hasKey && (
            <div className="text-xs text-qf-mute flex items-center justify-between">
              <span>מפתח שמור: <span dir="ltr" className="font-mono">{initial.maskedKey}</span></span>
              <button
                type="button"
                onClick={removeKey}
                className="text-qf-tomato hover:underline"
              >
                מחיקה
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={testKey}
            disabled={!canTest}
            className="px-4 py-2 rounded-xl border-2 border-(--qf-primary) text-(--qf-primary) hover:bg-(--qf-primary)/5 text-sm font-medium disabled:opacity-50"
          >
            {testBusy ? "בודק..." : "בדוק חיבור"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? "שומר..." : "שמירת שינויים"}
          </button>
          {toast && (
            <span className="inline-flex items-center gap-1.5 text-qf-green-deep text-sm">
              <IcoCheck c="currentColor" s={14} />
              {toast}
            </span>
          )}
          {error && <span className="text-qf-tomato text-sm">{error}</span>}
        </div>

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
              ? "החיבור ל-Gemini תקין — אפשר להפעיל את היועץ."
              : testResult.message}
          </div>
        )}
      </section>
    </div>
  );
}
