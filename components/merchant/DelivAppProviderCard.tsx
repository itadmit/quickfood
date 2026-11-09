"use client";

import { useEffect, useState } from "react";
import { IcoBike } from "@/components/shared/Icons";
import { Toggle } from "@/components/shared/Toggle";

interface DelivAppSettings {
  enabled: boolean;
  restId: string;
  appId: string;
  apiKeySet: boolean;
  webhookUrl: string | null;
  connected: boolean;
}

const inputCls =
  "w-full rounded-xl border border-qf-line-dash px-3 py-2 text-sm focus:outline-none focus:border-(--qf-primary)";

export function DelivAppProviderCard({
  onToast,
}: {
  onToast: (kind: "ok" | "err", message: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [restId, setRestId] = useState("");
  const [appId, setAppId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  function apply(s: DelivAppSettings) {
    setEnabled(s.enabled);
    setRestId(s.restId);
    setAppId(s.appId);
    setApiKeySet(s.apiKeySet);
    setWebhookUrl(s.webhookUrl);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/merchant/settings/delivapp", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.settings) return;
        apply(d.settings as DelivAppSettings);
        setOpen((d.settings as DelivAppSettings).enabled);
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(nextEnabled = enabled) {
    if (
      nextEnabled &&
      (!restId.trim() || !appId.trim() || (!apiKeySet && !apiKey.trim()))
    ) {
      setOpen(true);
      onToast("err", "מלאו RestID, Integration ID ו-API Key לפני ההפעלה");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/merchant/settings/delivapp", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          restId: restId.trim(),
          appId: appId.trim(),
          apiKey: apiKey.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast("err", data?.error?.message ?? "השמירה נכשלה");
        return;
      }
      setApiKey("");
      apply(data.settings as DelivAppSettings);
      onToast("ok", nextEnabled ? "DelivApp פעילה" : "DelivApp כובתה");
    } catch {
      onToast("err", "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <div className="rounded-xl border border-qf-line p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 min-w-0 text-right"
        >
          <span className="w-9 h-9 rounded-xl bg-qf-warm-dash grid place-items-center shrink-0">
            <IcoBike c="#3a4a40" s={18} />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-sm">DelivApp</span>
            <span className="block text-xs text-qf-mute">
              כל הזמנת משלוח שמאשרים נשלחת אוטומטית לאפליקציית DelivApp. סימון
              &quot;מוכן&quot;, ביטול וסטטוס השליח מסונכרנים.
            </span>
          </span>
        </button>
        <Toggle
          checked={enabled}
          disabled={saving}
          aria-label="הפעלת DelivApp"
          onChange={(next) => save(next)}
        />
      </div>

      {open && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-qf-ink2 mb-1">
                RestID (מזהה העסק ב-DelivApp)
              </span>
              <input
                className={inputCls}
                dir="ltr"
                name="delivapp-rest-id"
                autoComplete="off"
                value={restId}
                onChange={(e) => setRestId(e.target.value)}
                placeholder="למשל 12345"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-qf-ink2 mb-1">
                Integration ID (X-Parse-Application-Id)
              </span>
              <input
                className={inputCls}
                dir="ltr"
                name="delivapp-app-id"
                autoComplete="off"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                placeholder="Application Id מ-DelivApp"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-qf-ink2 mb-1">
                API Key (X-Parse-REST-API-Key)
              </span>
              <input
                className={inputCls}
                dir="ltr"
                type="password"
                name="delivapp-api-key"
                autoComplete="new-password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  apiKeySet
                    ? "שמור. השאירו ריק כדי לא לשנות"
                    : "REST API Key מ-DelivApp"
                }
              />
            </label>
          </div>

          {webhookUrl && (
            <div className="rounded-xl bg-qf-line-soft p-3 space-y-2">
              <div className="text-xs font-semibold text-qf-ink2">
                כתובת Webhook להדבקה ב-DelivApp (סודית)
              </div>
              <div className="flex items-center gap-2">
                <code
                  dir="ltr"
                  className="flex-1 text-[11px] bg-white border border-qf-line rounded-lg px-2.5 py-1.5 overflow-x-auto whitespace-nowrap"
                >
                  {webhookUrl}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(webhookUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {
                      onToast("err", "ההעתקה נכשלה");
                    }
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-qf-line-dash text-xs font-medium"
                >
                  {copied ? "הועתק" : "העתקה"}
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => save()}
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-qf-ink text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "שומר…" : "שמירה"}
          </button>
        </div>
      )}
    </div>
  );
}
