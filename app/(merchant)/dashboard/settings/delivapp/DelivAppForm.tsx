"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsSaveBar } from "@/components/merchant/SettingsSaveBar";

interface Initial {
  enabled: boolean;
  restId: string;
  appId: string;
  apiKeySet: boolean;
  webhookUrl: string | null;
  connected: boolean;
}

export function DelivAppForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [restId, setRestId] = useState(initial.restId);
  const [appId, setAppId] = useState(initial.appId);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(initial.apiKeySet);
  const [webhookUrl, setWebhookUrl] = useState(initial.webhookUrl);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/settings/delivapp", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled,
          restId: restId.trim(),
          appId: appId.trim(),
          apiKey: apiKey.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ kind: "err", msg: data?.error?.message ?? "שמירה נכשלה" });
        return;
      }
      setApiKey("");
      setApiKeySet(!!data.settings?.apiKeySet);
      setWebhookUrl(data.settings?.webhookUrl ?? null);
      setToast({ kind: "ok", msg: "נשמר" });
      router.refresh();
    } catch {
      setToast({ kind: "err", msg: "שגיאת רשת" });
    } finally {
      setSaving(false);
    }
  }

  async function copyWebhook() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked - user can select manually */
    }
  }

  const inputCls =
    "w-full px-3.5 py-2.5 rounded-xl border-2 border-black/15 focus:border-black bg-white text-sm font-medium outline-none transition";

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border-2 border-black shadow-[0_3px_0_#000] bg-white p-5 lg:p-6 space-y-5">
        <div className="space-y-1.5">
          <h2 className="text-lg font-black text-black">חיבור ל‑DelivApp</h2>
          <p className="text-sm text-black/60 leading-relaxed">
            כל הזמנת משלוח שתאשרו בקוויק‑פוד תישלח אוטומטית גם לאפליקציית הניהול של
            DelivApp, בנוסף לדשבורד הרגיל. סימון &quot;מוכן&quot; וביטול הזמנה מסונכרנים גם
            הם, ועדכוני סטטוס השליח חוזרים אוטומטית לדשבורד.
          </p>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-2xl border-2 border-black/10 px-4 py-3 cursor-pointer">
          <span className="text-sm font-bold text-black">
            הפעלת שליחה ל‑DelivApp
            {initial.connected && (
              <span className="mr-2 inline-block text-[11px] font-black text-qf-green-deep">
                מחובר
              </span>
            )}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={
              "relative w-12 h-7 rounded-full border-2 border-black transition-colors " +
              (enabled ? "bg-[#F8CB1E]" : "bg-black/10")
            }
          >
            <span
              className={
                "absolute top-0.5 w-5 h-5 rounded-full bg-black transition-all " +
                (enabled ? "right-0.5" : "right-[22px]")
              }
            />
          </button>
        </label>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-black/70">
              RestID (מזהה העסק ב‑DelivApp)
            </label>
            <input
              className={inputCls}
              value={restId}
              onChange={(e) => setRestId(e.target.value)}
              placeholder="למשל 12345"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-black/70">
              Integration ID (X‑Parse‑Application‑Id)
            </label>
            <input
              className={inputCls}
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="Application Id מ‑DelivApp"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-black/70">
              API Key (X‑Parse‑REST‑API‑Key)
            </label>
            <input
              className={inputCls}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeySet ? "•••••••• (שמור, השאירו ריק כדי לא לשנות)" : "REST API Key מ‑DelivApp"}
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {webhookUrl && (
        <div className="rounded-3xl border-2 border-black/15 bg-black/[0.02] p-5 space-y-2.5">
          <h3 className="text-sm font-black text-black">
            כתובת Webhook להדבקה ב‑DelivApp
          </h3>
          <p className="text-xs text-black/60 leading-relaxed">
            הדביקו את הכתובת הזו בהגדרות ה‑Webhook של DelivApp כדי שעדכוני סטטוס
            השליח יחזרו לדשבורד. הכתובת סודית, אל תשתפו אותה.
          </p>
          <div className="flex items-center gap-2">
            <code
              dir="ltr"
              className="flex-1 text-[11px] bg-white border-2 border-black/10 rounded-xl px-3 py-2 overflow-x-auto whitespace-nowrap"
            >
              {webhookUrl}
            </code>
            <button
              type="button"
              onClick={copyWebhook}
              className="shrink-0 px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold shadow-[0_2px_0_#000] active:translate-y-px"
            >
              {copied ? "הועתק" : "העתקה"}
            </button>
          </div>
        </div>
      )}

      <SettingsSaveBar saving={saving} onSave={save} toast={toast} />
    </div>
  );
}
