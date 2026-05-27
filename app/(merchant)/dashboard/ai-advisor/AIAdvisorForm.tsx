"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCheck } from "@/components/shared/Icons";
import { Toggle } from "@/components/shared/Toggle";
import { cn } from "@/lib/cn";

type Provider = "gemini" | "claude";

interface ProviderState {
  hasKey: boolean;
  maskedKey: string | null;
}

interface Initial {
  enabled: boolean;
  provider: Provider;
  gemini: ProviderState;
  claude: ProviderState;
}

const PROVIDER_META: Record<Provider, {
  label: string;
  pill: string;
  modelId: string;
  pricingNote: string;
  signupUrl: string;
  signupLabel: string;
  keyPlaceholder: string;
  keyPrefix: string;
  steps: string[];
  quotaNote: string;
}> = {
  gemini: {
    label: "Google Gemini",
    pill: "חינם · 1,500/יום",
    modelId: "gemini-2.5-flash",
    pricingNote: "שכבת חינם של Google AI Studio (כ-1,500 בקשות ביום, 15 בדקה).",
    signupUrl: "https://aistudio.google.com/apikey",
    signupLabel: "Google AI Studio",
    keyPlaceholder: "AIzaSy...",
    keyPrefix: "AIza…",
    steps: [
      "כנסו ל-Google AI Studio והתחברו עם חשבון Google.",
      "לחצו Create API key ובחרו פרויקט.",
      "העתיקו את המפתח שמתחיל ב-AIza… והדביקו כאן.",
      "לחצו בדוק חיבור, ואז שמירה, והפעילו את הטוגל.",
    ],
    quotaNote:
      "אם הגעתם למכסה (Quota exceeded), המתינו דקה או שדרגו לחשבון בתשלום ב-Google. אנו לא גובים תשלום נוסף.",
  },
  claude: {
    label: "Anthropic Claude",
    pill: "תשלום · Haiku 4.5",
    modelId: "claude-haiku-4-5",
    pricingNote: "Claude אינו בחינם — דורש כרטיס אשראי בחשבון Anthropic. בפועל כל שיחה עולה אגורות בודדות.",
    signupUrl: "https://console.anthropic.com/settings/keys",
    signupLabel: "Anthropic Console",
    keyPlaceholder: "sk-ant-...",
    keyPrefix: "sk-ant-…",
    steps: [
      "כנסו ל-Anthropic Console והוסיפו אמצעי תשלום ב-Billing.",
      "לחצו Create Key (Settings → API Keys).",
      "העתיקו את המפתח שמתחיל ב-sk-ant-… והדביקו כאן.",
      "לחצו בדוק חיבור, ואז שמירה, והפעילו את הטוגל.",
    ],
    quotaNote:
      "Anthropic גובים לפי שימוש — הקפידו להגדיר תקרת תקציב חודשית ב-Console כדי להגן על עצמכם.",
  },
};

export function AIAdvisorSettingsForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [gemini, setGemini] = useState<ProviderState>(initial.gemini);
  const [claude, setClaude] = useState<ProviderState>(initial.claude);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: true } | { ok: false; message: string } | null
  >(null);

  const meta = PROVIDER_META[provider];
  const active = provider === "claude" ? claude : gemini;
  const hasActiveKey = active.hasKey;

  async function save() {
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const payload: Record<string, unknown> = {
        enabled,
        provider,
      };
      if (keyInput.trim().length > 0) {
        payload[provider === "claude" ? "claude_api_key" : "gemini_api_key"] = keyInput.trim();
      }

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
      const s = data.settings;
      if (s) {
        setGemini({ hasKey: s.gemini.has_key, maskedKey: s.gemini.masked_key });
        setClaude({ hasKey: s.claude.has_key, maskedKey: s.claude.masked_key });
        setEnabled(s.enabled);
      }
      setToast("נשמר");
      router.refresh();
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 2000);
    }
  }

  async function removeKey() {
    if (!confirm(`למחוק את מפתח ${meta.label}?`)) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      payload[provider === "claude" ? "claude_api_key" : "gemini_api_key"] = null;
      const res = await fetch("/api/v1/merchant/ai/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.settings) {
        setGemini({ hasKey: data.settings.gemini.has_key, maskedKey: data.settings.gemini.masked_key });
        setClaude({ hasKey: data.settings.claude.has_key, maskedKey: data.settings.claude.masked_key });
        setEnabled(data.settings.enabled);
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
      const body: Record<string, unknown> = { provider };
      if (keyInput.trim().length > 0) body.api_key = keyInput.trim();
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

  const canTest = !testBusy && (keyInput.trim().length >= 10 || hasActiveKey);
  const canToggle = hasActiveKey || keyInput.trim().length > 0;

  return (
    <div className="space-y-5">
      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">יועץ AI ללקוחות</h2>
            <p className="text-xs lg:text-sm text-qf-mute mt-0.5 leading-relaxed">
              עוזר חכם שמופיע כפתור-צף בחנות שלך. הלקוח מתאר מה בא לו, היועץ ממליץ מהתפריט, ומציע פריט מותאם להוספה לעגלה — כולל מידה ותוספות לפי ההגבלות.
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5",
              enabled && hasActiveKey
                ? "bg-qf-green-soft text-qf-green-deep"
                : "bg-qf-line-soft text-qf-mute",
            )}
          >
            {enabled && hasActiveKey ? "פעיל" : "כבוי"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 py-2">
          <div>
            <div className="font-medium text-sm">הצג כפתור יועץ בחנות</div>
            <div className="text-xs text-qf-mute">דורש מפתח תקין עבור הספק שנבחר ({meta.label}).</div>
          </div>
          <Toggle checked={enabled} onChange={(v) => setEnabled(v)} disabled={!canToggle} />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">ספק ה-AI</h2>
          <p className="text-xs lg:text-sm text-qf-mute mt-0.5 leading-relaxed">
            בחרו את הספק שלכם. Gemini זול/חינמי אך בעל איכות עברית בינונית; Claude איכותי מאוד בעברית אך בתשלום.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(PROVIDER_META) as Provider[]).map((p) => {
            const m = PROVIDER_META[p];
            const isActive = provider === p;
            const ps = p === "claude" ? claude : gemini;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setProvider(p);
                  setKeyInput("");
                  setTestResult(null);
                }}
                className={cn(
                  "text-right rounded-2xl border-2 p-3 transition",
                  isActive
                    ? "border-black bg-qf-yolk-soft/30"
                    : "border-qf-line-dash hover:border-black/40",
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{m.label}</span>
                  {ps.hasKey && (
                    <span className="text-[10px] uppercase tracking-wide bg-qf-green-soft text-qf-green-deep px-2 py-0.5 rounded-full">
                      מוגדר
                    </span>
                  )}
                </div>
                <div className="text-xs text-qf-mute">{m.pill}</div>
                <div className="text-[11px] text-qf-mute mt-1" dir="ltr">{m.modelId}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">מפתח API · {meta.label}</h2>
          <p className="text-xs lg:text-sm text-qf-mute mt-0.5 leading-relaxed">{meta.pricingNote}</p>
        </div>

        <ol className="text-xs lg:text-sm text-qf-ink2 leading-relaxed list-decimal pr-5 space-y-1.5 bg-qf-yolk-soft/40 border border-qf-yolk/30 rounded-xl p-3">
          {meta.steps.map((step, i) => (
            <li key={i}>
              {i === 0 ? (
                <>
                  כנסו ל-
                  <a
                    href={meta.signupUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-(--qf-primary) underline font-medium mx-1"
                  >
                    {meta.signupLabel}
                  </a>
                  {step.replace(/^כנסו ל-[^.]+\.\s*/, "")}
                </>
              ) : (
                step
              )}
            </li>
          ))}
        </ol>

        <div className="text-xs text-qf-mute leading-relaxed bg-qf-line-soft rounded-xl px-3 py-2">
          <strong>שימו לב:</strong> {meta.quotaNote}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium block">מפתח {meta.label}</label>
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            dir="ltr"
            placeholder={hasActiveKey ? (active.maskedKey ?? "•••••") : meta.keyPlaceholder}
            type="password"
            autoComplete="off"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm font-mono"
          />
          {hasActiveKey && (
            <div className="text-xs text-qf-mute flex items-center justify-between">
              <span>מפתח שמור: <span dir="ltr" className="font-mono">{active.maskedKey}</span></span>
              <button type="button" onClick={removeKey} className="text-qf-tomato hover:underline">
                מחיקה
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2 flex-wrap">
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
              ? `החיבור ל-${meta.label} תקין — אפשר להפעיל את היועץ.`
              : testResult.message}
          </div>
        )}
      </section>
    </div>
  );
}
