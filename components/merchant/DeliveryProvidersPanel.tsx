"use client";

import { useEffect, useState } from "react";
import { IcoBike } from "@/components/shared/Icons";
import { Toggle } from "@/components/shared/Toggle";
import { DelivAppProviderCard } from "@/components/merchant/DelivAppProviderCard";

interface ProviderField {
  key: string;
  label: string;
  secret: boolean;
  placeholder: string | null;
  optional?: boolean;
  options?: Array<{ value: string; label: string }> | null;
  value: string;
  is_set: boolean;
}

interface ProviderRow {
  id: string;
  label: string;
  description: string;
  fields: ProviderField[];
  enabled: boolean;
  auto_dispatch: boolean;
  prep_minutes: number;
}

export function DeliveryProvidersPanel({
  onToast,
}: {
  onToast: (kind: "ok" | "err", message: string) => void;
}) {
  const [providers, setProviders] = useState<ProviderRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/merchant/delivery-providers", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => !cancelled && setProviders(d.providers ?? []))
      .catch(() => !cancelled && setProviders([]));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!providers || providers.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-qf-line-dash p-4 space-y-3">
      <div>
        <div className="font-semibold text-sm">חברות משלוחים</div>
        <div className="text-xs text-qf-mute mt-0.5">
          חברה פעילה מופיעה בחלון מסירת ההזמנה לשליח, במקום שליח פנימי
        </div>
      </div>
      {providers.map((p) => (
        <ProviderCard
          key={p.id}
          provider={p}
          onSaved={(rows) => setProviders(rows)}
          onToast={onToast}
        />
      ))}
      <DelivAppProviderCard onToast={onToast} />
    </section>
  );
}

function ProviderCard({
  provider,
  onSaved,
  onToast,
}: {
  provider: ProviderRow;
  onSaved: (rows: ProviderRow[]) => void;
  onToast: (kind: "ok" | "err", message: string) => void;
}) {
  const [open, setOpen] = useState(provider.enabled);
  const [enabled, setEnabled] = useState(provider.enabled);
  const [auto, setAuto] = useState(provider.auto_dispatch);
  const [prep, setPrep] = useState(String(provider.prep_minutes));
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(provider.fields.map((f) => [f.key, f.value])),
  );
  const [saving, setSaving] = useState(false);

  async function save(nextEnabled = enabled) {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/merchant/delivery-providers", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: provider.id,
          enabled: nextEnabled,
          auto_dispatch: auto,
          prep_minutes: Math.max(1, Math.min(240, Number(prep) || 15)),
          values,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onToast("err", data?.error?.message ?? "השמירה נכשלה");
        return false;
      }
      setEnabled(nextEnabled);
      onSaved(data.providers ?? []);
      onToast(
        "ok",
        nextEnabled ? `${provider.label} פעילה` : `${provider.label} כובתה`,
      );
      return true;
    } catch {
      onToast("err", "השמירה נכשלה");
      return false;
    } finally {
      setSaving(false);
    }
  }

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
            <span className="block font-semibold text-sm">
              {provider.label}
            </span>
            <span className="block text-xs text-qf-mute">
              {provider.description}
            </span>
          </span>
        </button>
        <Toggle
          checked={enabled}
          disabled={saving}
          aria-label={`הפעלת ${provider.label}`}
          onChange={async (next) => {
            if (next) setOpen(true);
            await save(next);
          }}
        />
      </div>

      {open && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {provider.fields.map((f) => (
              <label key={f.key} className="block">
                <span className="block text-xs font-medium text-qf-ink2 mb-1">
                  {f.label}
                </span>
                {f.options ? (
                  <select
                    value={values[f.key] || f.options[0]?.value}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                    className="w-full rounded-xl border border-qf-line-dash px-3 py-2 text-sm bg-white focus:outline-none focus:border-(--qf-primary)"
                  >
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.secret ? "password" : "text"}
                    dir="ltr"
                    name={`${provider.id}-${f.key}`}
                    autoComplete={f.secret ? "new-password" : "off"}
                    value={values[f.key] ?? ""}
                    placeholder={
                      f.secret && f.is_set
                        ? "שמור. השאירו ריק כדי לא לשנות"
                        : (f.placeholder ?? "")
                    }
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                    className="w-full rounded-xl border border-qf-line-dash px-3 py-2 text-sm focus:outline-none focus:border-(--qf-primary)"
                  />
                )}
              </label>
            ))}
            <label className="block">
              <span className="block text-xs font-medium text-qf-ink2 mb-1">
                זמן הכנה שנשלח לחברה (דקות)
              </span>
              <input
                type="number"
                min={1}
                max={240}
                value={prep}
                onChange={(e) => setPrep(e.target.value)}
                className="w-full rounded-xl border border-qf-line-dash px-3 py-2 text-sm tnum focus:outline-none focus:border-(--qf-primary)"
              />
            </label>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                שליחה אוטומטית כשמאשרים הזמנה
              </div>
              <div className="text-xs text-qf-mute">
                כל הזמנת משלוח שתאושר תישלח ל{provider.label} מיד, בלי לבחור
                בחלון השליחים
              </div>
            </div>
            <Toggle
              checked={auto}
              onChange={setAuto}
              aria-label="שליחה אוטומטית"
            />
          </div>
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
