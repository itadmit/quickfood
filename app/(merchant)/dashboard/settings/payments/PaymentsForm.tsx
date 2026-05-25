"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoCash, IcoCheck, IcoClose, IcoCreditCard } from "@/components/shared/Icons";
import { Toggle as SharedToggle } from "@/components/shared/Toggle";

interface GrowState {
  is_active: boolean;
  test_mode: boolean;
  user_id: string;
  page_code: string;
  max_installments: number;
  apple_pay_domain_association: string;
}

type CustomerPaymentMethod = "cash" | "card" | "bit" | "apple_pay" | "google_pay";

const PAYMENT_METHOD_LABELS: Record<CustomerPaymentMethod, string> = {
  cash: "מזומן בעת המסירה",
  card: "כרטיס אשראי",
  bit: "Bit",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
};

interface Initial {
  accepts_cash: boolean;
  default_payment_method: CustomerPaymentMethod | null;
  grow: GrowState;
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

  function setCash(b: boolean) {
    setV((x) => ({ ...x, accepts_cash: b }));
  }
  function setGrow<K extends keyof GrowState>(k: K, val: GrowState[K]) {
    setV((x) => ({ ...x, grow: { ...x.grow, [k]: val } }));
  }
  function setDefaultMethod(m: CustomerPaymentMethod | null) {
    setV((x) => ({ ...x, default_payment_method: m }));
  }

  const hasAnyActive = v.accepts_cash || v.grow.is_active;

  // Methods that are currently enabled — this drives the default-method
  // dropdown so the merchant can't pick a method that won't appear at
  // checkout. Order mirrors what the public storefront API will return
  // (which is also the order on the customer's pill grid).
  const enabledMethods: CustomerPaymentMethod[] = [];
  if (v.accepts_cash) enabledMethods.push("cash");
  if (v.grow.is_active) {
    enabledMethods.push("card", "bit", "apple_pay", "google_pay");
  }
  // If the previously-saved default is no longer enabled, drop it on the
  // client so the customer doesn't end up with a stale selection after save.
  const effectiveDefault =
    v.default_payment_method && enabledMethods.includes(v.default_payment_method)
      ? v.default_payment_method
      : null;

  async function save() {
    if (!hasAnyActive) {
      setToast({
        kind: "err",
        msg: "חייב להפעיל לפחות אמצעי תשלום אחד",
      });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/v1/merchant/payments", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accepts_cash: v.accepts_cash,
          // Always send the effective default — if the saved one is no
          // longer enabled, this sends null so the server clears it.
          default_payment_method: effectiveDefault,
          grow: {
            is_active: v.grow.is_active,
            test_mode: v.grow.test_mode,
            user_id: v.grow.user_id || undefined,
            page_code: v.grow.page_code || undefined,
            max_installments: v.grow.max_installments,
            apple_pay_domain_association: canEditApplePay
              ? v.grow.apple_pay_domain_association
              : undefined,
          },
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

  return (
    <div className="space-y-5">
      {/* Section: which methods to accept */}
      <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-base lg:text-lg">אמצעי תשלום שהמסעדה מקבלת</h2>
          <p className="text-sm text-qf-mute mt-0.5">
            סמן את כל מה שאתה רוצה לקבל. הלקוח יבחר בקופה.
          </p>
        </div>

        <MethodRow
          icon={<IcoCash s={20} />}
          title="מזומן"
          sub="הלקוח משלם לשליח או בקופה. אין סליקה."
          checked={v.accepts_cash}
          onChange={setCash}
        />
        <MethodRow
          icon={<IcoCreditCard s={20} />}
          title="Grow — אשראי · Bit · Apple Pay · Google Pay"
          sub="מצריך חשבון Grow פעיל. ההגדרות בהמשך."
          checked={v.grow.is_active}
          onChange={(b) => setGrow("is_active", b)}
        />

        {!hasAnyActive && (
          <div className="rounded-xl bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm px-3.5 py-2.5">
            חייב להפעיל לפחות אמצעי תשלום אחד.
          </div>
        )}
      </div>

      {/* Default method selector — only visible when there's more than one
          enabled method (otherwise the choice is trivial). */}
      {enabledMethods.length > 1 && (
        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-base lg:text-lg">אמצעי תשלום ברירת מחדל</h2>
            <p className="text-sm text-qf-mute mt-0.5">
              איזה אמצעי תשלום יהיה מסומן ראשון לקופה. הלקוח עדיין יוכל לבחור אחר.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {enabledMethods.map((m) => {
              const active = effectiveDefault === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDefaultMethod(m)}
                  aria-pressed={active}
                  className={
                    "px-3.5 py-3 rounded-xl border-2 text-start text-sm font-medium transition " +
                    (active
                      ? "border-(--qf-primary) bg-qf-green-soft"
                      : "border-qf-line-dash bg-white hover:bg-qf-line-soft")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{PAYMENT_METHOD_LABELS[m]}</span>
                    {active && <IcoCheck c="var(--qf-primary)" s={14} />}
                  </div>
                </button>
              );
            })}
          </div>
          {effectiveDefault && (
            <button
              type="button"
              onClick={() => setDefaultMethod(null)}
              className="text-xs text-qf-mute hover:text-qf-ink underline"
            >
              בלי ברירת מחדל (השאר על הסדר הדיפולטיבי)
            </button>
          )}
        </div>
      )}

      {/* Grow config — only when Grow is enabled */}
      {v.grow.is_active && (
        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-base lg:text-lg">הגדרות חשבון Grow</h2>
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

          <Field
            label="User ID"
            hint="מזהה הסוחר שלך אצל Grow (לדוגמה: 814d52344861c4a3)"
          >
            <input
              value={v.grow.user_id}
              onChange={(e) => setGrow("user_id", e.target.value.trim())}
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
                checked={v.grow.test_mode}
                onChange={(b) => setGrow("test_mode", b)}
                label={v.grow.test_mode ? "Sandbox" : "Production"}
              />
            </Field>
            <Field
              label="מספר תשלומים מקסימלי"
              hint="1 = ללא תשלומים. עד 12 חודשי תשלומים."
            >
              <select
                value={v.grow.max_installments}
                onChange={(e) =>
                  setGrow("max_installments", parseInt(e.target.value, 10))
                }
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
                  value={v.grow.page_code}
                  onChange={(e) => setGrow("page_code", e.target.value.trim())}
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none font-mono text-sm"
                />
              </Field>
            </div>
          </details>
        </div>
      )}

      {/* Apple Pay verification — only when Grow is on AND tenant has custom domain */}
      {v.grow.is_active && (
        <div className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-base lg:text-lg">Apple Pay — אישור דומיין</h2>
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
                  value={v.grow.apple_pay_domain_association}
                  onChange={(e) =>
                    setGrow("apple_pay_domain_association", e.target.value)
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
                "inline-flex items-center gap-1.5 " +
                (toast.kind === "ok" ? "text-qf-green-deep" : "text-qf-tomato")
              }
            >
              {toast.kind === "ok" ? (
                <IcoCheck c="currentColor" s={14} />
              ) : (
                <IcoClose c="currentColor" s={14} />
              )}
              {toast.msg}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !hasAnyActive}
          className="px-5 py-2.5 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "שומר..." : "שמירת שינויים"}
        </button>
      </div>
    </div>
  );
}

function MethodRow({
  icon,
  title,
  sub,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  checked: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={
        "w-full flex items-start gap-3 p-3.5 rounded-xl border-2 text-start transition " +
        (checked
          ? "border-(--qf-primary) bg-qf-green-soft"
          : "border-qf-line-dash bg-white hover:bg-qf-line-soft")
      }
    >
      <div className="w-10 h-10 rounded-lg bg-white border border-qf-line-dash grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-qf-mute mt-0.5">{sub}</div>
      </div>
      <CheckBox checked={checked} />
    </button>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <div
      className={
        "w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 grid place-items-center transition " +
        (checked
          ? "border-(--qf-primary) bg-(--qf-primary)"
          : "border-qf-line-dash")
      }
      aria-hidden
    >
      {checked && <IcoCheck c="#fff" s={12} />}
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
    <div className="inline-flex items-center gap-2 select-none">
      <SharedToggle checked={checked} onChange={onChange} aria-label={label} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
