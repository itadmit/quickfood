"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCheck } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

interface Initial {
  token: string;
  instanceId: string;
}

export function WhatsappSettingsForm({
  initial,
  creditsRemaining,
}: {
  initial: Initial;
  creditsRemaining: number;
}) {
  const router = useRouter();
  const [v, setV] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch("/api/v1/merchant/whatsapp/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: v.token.trim() || null,
          instance_id: v.instanceId.trim() || null,
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
      setTimeout(() => setToast(null), 2000);
    }
  }

  async function sendTest() {
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/merchant/whatsapp/test", {
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
      const status: string = data.result?.status ?? "unknown";
      if (status === "sent") {
        setTestResult({ ok: true });
      } else if (status === "invalid_recipient") {
        setTestResult({
          ok: false,
          message: "מספר טלפון לא תקין (פורמט: 05XXXXXXXX)",
        });
      } else if (status === "not_configured") {
        setTestResult({
          ok: false,
          message: "חסר Token או Instance ID. שמור את ההגדרות לפני שליחת בדיקה.",
        });
      } else {
        setTestResult({
          ok: false,
          message: data.result?.providerMsg || `סטטוס: ${status}`,
        });
      }
    } finally {
      setTestBusy(false);
    }
  }

  const connected = !!initial.token && !!initial.instanceId;
  const canTest = connected && !testBusy && testPhone.trim().length >= 9;

  return (
    <div className="space-y-5 max-w-2xl">
      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base lg:text-lg font-semibold">פרטי חיבור</h2>
            <p className="text-xs lg:text-sm text-qf-mute mt-0.5">
              נרשמים ל-iBot Chat, מחברים את מספר ה-WhatsApp העסקי שלכם, ומדביקים כאן את ה-Token וה-Instance ID. השליחה תצא ממספר ה-WhatsApp שחיברתם.
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5",
              connected
                ? "bg-qf-green-soft text-qf-green-deep"
                : "bg-qf-line-soft text-qf-mute",
            )}
          >
            {connected ? "מחובר" : "לא מחובר"}
          </span>
        </div>

        <Field label="Token (API key)" hint="ה-Instance ID של iBot משמש כ-Token לקריאות API.">
          <input
            value={v.token}
            onChange={(e) => set("token", e.target.value)}
            dir="ltr"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
          />
        </Field>

        <Field label="Instance ID" hint="מזהה ה-instance של חיבור ה-WhatsApp שלך ב-iBot.">
          <input
            value={v.instanceId}
            onChange={(e) => set("instanceId", e.target.value)}
            dir="ltr"
            placeholder="abc123-instance"
            className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
          />
        </Field>

        <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-xs text-qf-ink2">
          כל הודעה נשלחת ב-WhatsApp תוריד הודעה אחת מהיתרה המשותפת ל-SMS ו-WhatsApp (כרגע: {creditsRemaining} זמינות).
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
            className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          >
            {saving ? "שומר..." : "שמירת שינויים"}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
        <div>
          <h2 className="text-base lg:text-lg font-semibold">בדיקת WhatsApp</h2>
          <p className="text-xs lg:text-sm text-qf-mute">
            שליחת הודעת בדיקה כדי לוודא שהחיבור עובד. הפלטפורמה סופגת את העלות — לא יוריד מהיתרה.
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
        {!connected && (
          <div className="text-xs text-qf-mute">
            יש לשמור Token ו-Instance ID לפני שניתן לשלוח בדיקה.
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
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium block">{label}</label>
      {children}
      {hint && <div className="text-xs text-qf-mute">{hint}</div>}
    </div>
  );
}
