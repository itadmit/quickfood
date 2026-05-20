"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Provider = "cash" | "grow";

interface Initial {
  provider: Provider;
  is_active: boolean;
  test_mode: boolean;
  user_id: string;
  page_code: string;
  max_installments: number;
  apple_pay_domain_association: string;
}

interface Props {
  initial: Initial;
  canEditApplePay: boolean;
  customDomain: string | null;
}

export function PaymentsForm({ initial, canEditApplePay, customDomain }: Props) {
  const router = useRouter();
  const [v, setV] = useState<Initial>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  function set<K extends keyof Initial>(k: K, val: Initial[K]) {
    setV((x) => ({ ...x, [k]: val }));
  }

  async function save() {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/payments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: v.provider,
          is_active: v.provider === "grow" ? v.is_active : false,
          test_mode: v.test_mode,
          user_id: v.user_id || undefined,
          page_code: v.page_code || undefined,
          max_installments: v.max_installments,
          apple_pay_domain_association: canEditApplePay
            ? v.apple_pay_domain_association
            : undefined,
        }),
      });
      const data = (await res.json()) as { error?: { message?: string } };
      if (res.ok) {
        setToast({ kind: "ok", msg: "נשמר" });
        router.refresh();
      } else {
        setToast({ kind: "err", msg: data.error?.message ?? "שמירה נכשלה" });
      }
    } catch {
      setToast({ kind: "err", msg: "שגיאת רשת" });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  const showGrow = v.provider === "grow";

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Provider picker */}
      <div className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-4">
        <h2 className="font-semibold text-lg">ספק תשלום</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ProviderCard
            checked={v.provider === "cash"}
            onClick={() => set("provider", "cash")}
            title="מזומן בלבד"
            sub="הלקוח משלם לשליח / בקופה. בלי סליקה."
            icon="₪"
          />
          <ProviderCard
            checked={v.provider === "grow"}
            onClick={() => set("provider", "grow")}
            title="Grow"
            sub="אשראי · Bit · Apple Pay · Google Pay"
            icon="💳"
          />
        </div>
      </div>

      {/* Grow config */}
      {showGrow && (
        <div className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-lg">הגדרות חשבון Grow</h2>
              <p className="text-sm text-qf-mute mt-0.5">
                מקבלים את הפרטים אחרי שמשלימים onboarding מול{" "}
                <a
                  href="https://grow-il.readme.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-(--qf-deep)"
                >
                  Grow
                </a>
              </p>
            </div>
            <Toggle
              checked={v.is_active}
              onChange={(b) => set("is_active", b)}
              label={v.is_active ? "פעיל" : "כבוי"}
            />
          </div>

          <Field
            label="User ID"
            hint="מזהה הסוחר שלך אצל Grow (לדוגמה: 814d52344861c4a3)"
          >
            <input
              value={v.user_id}
              onChange={(e) => set("user_id", e.target.value.trim())}
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none font-mono text-sm"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="מצב טסט (Sandbox)"
              hint="כל עוד פעיל — Grow לא יחייב כרטיסים אמיתיים"
            >
              <Toggle
                checked={v.test_mode}
                onChange={(b) => set("test_mode", b)}
                label={v.test_mode ? "Sandbox" : "Production"}
              />
            </Field>
            <Field
              label="מספר תשלומים מקסימלי"
              hint="1 = ללא תשלומים. עד 12 חודשי תשלומים."
            >
              <select
                value={v.max_installments}
                onChange={(e) => set("max_installments", parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none bg-white tnum"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "תשלום אחד (ללא תשלומים)" : `עד ${n} תשלומים`}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <details className="rounded-xl border border-qf-line-soft">
            <summary className="px-3.5 py-2.5 text-sm cursor-pointer select-none">
              הגדרות מתקדמות (לרוב לא דרושות)
            </summary>
            <div className="px-3.5 pb-3.5 pt-1 space-y-3">
              <Field
                label="Page Code override"
                hint="השאר ריק כדי להשתמש ב-pageCode הפלטפורמתי. הגדר רק אם Grow הקצה לך pageCode ייעודי."
              >
                <input
                  value={v.page_code}
                  onChange={(e) => set("page_code", e.target.value.trim())}
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none font-mono text-sm"
                />
              </Field>
            </div>
          </details>
        </div>
      )}

      {/* Apple Pay verification — only with custom domain */}
      {showGrow && (
        <div className="bg-white rounded-2xl border border-qf-line-dash p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-lg">Apple Pay — אישור דומיין</h2>
            <p className="text-sm text-qf-mute mt-0.5">
              דרוש רק אם החנות שלך רצה על דומיין מותאם (custom domain).
            </p>
          </div>

          {!canEditApplePay ? (
            <div className="rounded-xl bg-qf-line-soft border border-qf-line-dash px-3.5 py-3 text-sm text-qf-ink2">
              אתה משתמש בדומיין של QuickFood — Apple Pay יעבוד אוטומטית בלי
              הגדרה. אם תחבר custom domain תוכל להעלות כאן את קובץ ה-verification
              שתקבל מ-Grow.
            </div>
          ) : (
            <>
              <div className="text-xs text-qf-mute" dir="ltr">
                Domain:{" "}
                <span className="font-mono">{customDomain}</span> ·{" "}
                Path:{" "}
                <span className="font-mono">
                  /.well-known/apple-developer-merchantid-domain-association
                </span>
              </div>
              <Field
                label="תוכן הקובץ מ-Grow"
                hint="הדבק כאן את התוכן של הקובץ apple-developer-merchantid-domain-association ש-Grow הנפיק עבור הדומיין הזה. אנחנו נגיש אותו ב-URL הנכון אוטומטית."
              >
                <textarea
                  value={v.apple_pay_domain_association}
                  onChange={(e) =>
                    set("apple_pay_domain_association", e.target.value)
                  }
                  dir="ltr"
                  rows={6}
                  spellCheck={false}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none font-mono text-xs"
                />
              </Field>
            </>
          )}
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-sm">
          {toast && (
            <span
              className={
                toast.kind === "ok" ? "text-qf-green-deep" : "text-qf-tomato"
              }
            >
              {toast.kind === "ok" ? "✓" : "✕"} {toast.msg}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
        >
          {saving ? "שומר..." : "שמירת שינויים"}
        </button>
      </div>
    </div>
  );
}

function ProviderCard({
  checked,
  onClick,
  title,
  sub,
  icon,
}: {
  checked: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-start gap-3 p-3.5 rounded-xl border-2 text-start transition " +
        (checked
          ? "border-(--qf-primary) bg-qf-green-soft"
          : "border-qf-line-dash bg-white hover:bg-qf-line-soft")
      }
      aria-pressed={checked}
    >
      <div className="w-10 h-10 rounded-lg bg-white border border-qf-line-dash grid place-items-center text-lg shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-qf-mute mt-0.5">{sub}</div>
      </div>
      <div
        className={
          "w-5 h-5 rounded-full border-2 shrink-0 mt-1 " +
          (checked
            ? "border-(--qf-primary) bg-(--qf-primary)"
            : "border-qf-line-dash")
        }
        aria-hidden
      />
    </button>
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
      {hint && <p className="text-xs text-qf-mute">{hint}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 select-none"
    >
      <span
        className={
          "w-10 h-6 rounded-full relative transition " +
          (checked ? "bg-(--qf-primary)" : "bg-qf-line-dash")
        }
      >
        <span
          className={
            "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition " +
            (checked ? "start-[18px]" : "start-0.5")
          }
        />
      </span>
      <span className="text-sm">{label}</span>
    </button>
  );
}
