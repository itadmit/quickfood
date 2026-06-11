"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Toggle } from "@/components/shared/Toggle";

type Status = "active" | "suspended" | "trial";

interface TenantUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

interface TenantBranch {
  id: string;
  name: string;
  address: string;
  phone: string;
  isPrimary: boolean;
}

interface InitialData {
  id: string;
  slug: string;
  name: string;
  status: string;
  themeId: string;
  businessType: string;
  cuisineType: string | null;
  vatNumber: string | null;
  customDomain: string | null;
  acceptsCash: boolean;
  smsCreditsRemaining: number;
  whatsappToken: string | null;
  whatsappInstanceId: string | null;
  plan: string | null;
  billingSetupCompletedAt: string | null;
  trialEndsAt: string | null;
  createdAt: string;
  counts: {
    orders: number;
    campaigns: number;
    smsLogs: number;
    branches: number;
  };
  branches: TenantBranch[];
  users: TenantUser[];
}

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  suspended: "מושעה",
  trial: "ניסיון",
};

const BUSINESS_TYPES: Array<{ val: string; label: string }> = [
  { val: "pizza", label: "פיצריה" },
  { val: "burger", label: "המבורגריה" },
  { val: "falafel", label: "פלאפל" },
  { val: "shawarma", label: "שווארמה" },
  { val: "sushi", label: "סושי" },
  { val: "asian", label: "אסייאתי" },
  { val: "bakery", label: "מאפייה" },
  { val: "cafe", label: "בית קפה" },
  { val: "icecream", label: "גלידה" },
  { val: "mediterranean", label: "ים תיכוני" },
  { val: "general", label: "כללי" },
];

const THEMES: Array<{ val: string; label: string }> = [
  { val: "fresh", label: "Fresh" },
  { val: "basil", label: "Basil" },
  { val: "forest", label: "Forest" },
  { val: "olive", label: "Olive" },
  { val: "tomato", label: "Tomato" },
  { val: "charcoal", label: "Charcoal" },
  { val: "cobalt", label: "Cobalt" },
];

const ROLE_LABEL: Record<string, string> = {
  owner: "בעלים",
  manager: "מנהל",
  kitchen: "מטבח",
  courier_dispatch: "ניהול שליחים",
  platform_admin: "מנהל פלטפורמה",
};

export function TenantDetail({ initial }: { initial: InitialData }) {
  const router = useRouter();
  const [t, setT] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function set<K extends keyof InitialData>(k: K, v: InitialData[K]) {
    setT((x) => ({ ...x, [k]: v }));
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${t.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: t.name,
          status: t.status as Status,
          theme_id: t.themeId,
          business_type: t.businessType,
          cuisine_type: t.cuisineType ?? "",
          vat_number: t.vatNumber ?? "",
          custom_domain: t.customDomain ?? "",
          accepts_cash: t.acceptsCash,
          whatsapp_token: t.whatsappToken ?? "",
          whatsapp_instance_id: t.whatsappInstanceId ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "שמירה נכשלה");
        return;
      }
      flash("נשמר");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function extendTrial(days: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${t.id}/extend-trial`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "הארכת הניסיון נכשלה");
        return;
      }
      set("trialEndsAt", data?.tenant?.trial_ends_at ?? t.trialEndsAt);
      flash(`תקופת הניסיון הוארכה ב-${days} ימים`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function loginAsUser() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${t.id}/impersonate`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash(data?.error?.message ?? "ההתחברות נכשלה");
        setSaving(false);
        return;
      }
      window.location.href = data?.redirect ?? "/dashboard";
    } catch {
      flash("שגיאת רשת");
      setSaving(false);
    }
  }

  async function toggleStatus() {
    const next: Status = t.status === "active" ? "suspended" : "active";
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${t.id}/suspend`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        set("status", next);
        flash(next === "active" ? "המסעדה הופעלה" : "המסעדה הושעתה");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteTenant() {
    const ok = window.confirm(
      `מחיקת ${t.name}? הפעולה אינה הפיכה - כל המסעדה, ההזמנות, התפריט והמשתמשים יימחקו לצמיתות.`,
    );
    if (!ok) return;
    const second = window.prompt(`להמשך - הקלד את ה-slug של המסעדה: ${t.slug}`);
    if (second !== t.slug) {
      window.alert("slug שגוי. הפעולה בוטלה.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${t.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/tenants");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? "המחיקה נכשלה");
      }
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(userId: string, userName: string) {
    const pw = window.prompt(
      `סיסמה חדשה עבור ${userName} (לפחות 8 תווים):`,
    );
    if (!pw) return;
    if (pw.length < 8) {
      window.alert("הסיסמה חייבת להיות לפחות 8 תווים.");
      return;
    }
    try {
      const res = await fetch(
        `/api/v1/admin/tenants/${t.id}/users/${userId}/reset-password`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: pw }),
        },
      );
      if (res.ok) {
        flash(`סיסמה אופסה עבור ${userName}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? "איפוס נכשל");
      }
    } catch {
      setError("שגיאת רשת");
    }
  }

  async function verifyEmail(userId: string, userName: string) {
    if (!window.confirm(`לאמת את המייל של ${userName} ידנית? באנר ה"אמת חשבון" יוסתר.`)) return;
    try {
      const res = await fetch(
        `/api/v1/admin/tenants/${t.id}/users/${userId}/verify-email`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const stamp =
          (data?.verified_at as string | undefined) ?? new Date().toISOString();
        setT((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId ? { ...u, emailVerifiedAt: stamp } : u,
          ),
        }));
        flash(`המייל של ${userName} אומת`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? "אימות נכשל");
      }
    } catch {
      setError("שגיאת רשת");
    }
  }

  async function unverifyEmail(userId: string, userName: string) {
    if (!window.confirm(`לבטל את אימות המייל של ${userName}? באנר ה"אמת חשבון" יחזור.`)) return;
    try {
      const res = await fetch(
        `/api/v1/admin/tenants/${t.id}/users/${userId}/verify-email`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setT((prev) => ({
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId ? { ...u, emailVerifiedAt: null } : u,
          ),
        }));
        flash(`אימות בוטל עבור ${userName}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error?.message ?? "ביטול נכשל");
      }
    } catch {
      setError("שגיאת רשת");
    }
  }

  const whatsappConnected = !!t.whatsappToken && !!t.whatsappInstanceId;

  const trialEndsAtMs = t.trialEndsAt ? new Date(t.trialEndsAt).getTime() : null;
  const trialExpired = trialEndsAtMs !== null && trialEndsAtMs < Date.now();
  const trialDaysLeft =
    trialEndsAtMs !== null
      ? Math.max(0, Math.ceil((trialEndsAtMs - Date.now()) / 86_400_000))
      : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/tenants"
            className="text-xs text-qf-mute hover:text-qf-ink"
          >
            ← חזרה לרשימה
          </Link>
          <h1 className="text-2xl font-bold mt-1 flex items-center gap-3">
            {t.name}
            <span
              className={cn(
                "text-xs px-2 py-0.5 rounded-md",
                t.status === "active"
                  ? "bg-qf-green-soft text-qf-green-deep"
                  : t.status === "suspended"
                    ? "bg-qf-tomato-soft text-qf-tomato"
                    : "bg-qf-yolk-soft text-qf-ink2",
              )}
            >
              {STATUS_LABEL[t.status] ?? t.status}
            </span>
          </h1>
          <div className="text-sm text-qf-mute" dir="ltr">
            /{t.slug} · {formatDate(t.createdAt)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href={`/s/${t.slug}`}
            target="_blank"
            className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-sm hover:bg-qf-line-soft"
          >
            צפה בחנות
          </Link>
          <button
            type="button"
            onClick={loginAsUser}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-qf-ink text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            התחבר כמשתמש
          </button>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={saving}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium",
              t.status === "active"
                ? "border border-qf-tomato/40 text-qf-tomato hover:bg-qf-tomato-soft"
                : "bg-(--qf-primary) text-white",
            )}
          >
            {t.status === "active" ? "השעה" : "הפעל"}
          </button>
          <button
            type="button"
            onClick={deleteTenant}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-qf-tomato text-white text-sm font-medium"
          >
            מחק
          </button>
        </div>
      </header>

      {toast && (
        <div className="bg-qf-green-soft border border-(--qf-primary)/30 text-qf-green-deep rounded-xl px-3 py-2 text-sm">
          {toast}
        </div>
      )}
      {error && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-xl px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Stat label="הזמנות" value={t.counts.orders} />
        <Stat label="סניפים" value={t.counts.branches} />
        <Stat label="קמפיינים" value={t.counts.campaigns} />
        <Stat label="יתרת הודעות" value={t.smsCreditsRemaining} />
      </div>

      {/* Trial period */}
      <Section title="תקופת ניסיון">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            {t.trialEndsAt ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm">
                  תאריך סיום:{" "}
                  <span className="font-medium" dir="ltr">
                    {formatDateTime(t.trialEndsAt)}
                  </span>
                </span>
                {trialExpired ? (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-qf-tomato-soft text-qf-tomato font-medium">
                    פג תוקף
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-qf-green-soft text-qf-green-deep font-medium">
                    נותרו {trialDaysLeft} ימים
                  </span>
                )}
              </div>
            ) : (
              <span className="text-sm text-qf-mute">
                למסעדה זו לא הוגדרה תקופת ניסיון.
              </span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => extendTrial(7)}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-sm font-medium hover:bg-qf-line-soft disabled:opacity-60"
            >
              הארך ב-7 ימים
            </button>
            <button
              type="button"
              onClick={() => extendTrial(30)}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-(--qf-primary) text-white text-sm font-medium disabled:opacity-60"
            >
              הארך ב-30 ימים
            </button>
          </div>
        </div>
      </Section>

      {/* Editable details */}
      <Section title="פרטי מסעדה">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="שם המסעדה">
            <Input value={t.name} onChange={(v) => set("name", v)} />
          </Field>
          <Field label="Slug (לקריאה בלבד)" hint="לא ניתן לשינוי לאחר היצירה.">
            <Input value={t.slug} onChange={() => {}} disabled />
          </Field>
          <Field label="סוג עסק">
            <Select
              value={t.businessType}
              onChange={(v) => set("businessType", v)}
              options={BUSINESS_TYPES}
            />
          </Field>
          <Field label="ערכת צבעים">
            <Select
              value={t.themeId}
              onChange={(v) => set("themeId", v)}
              options={THEMES}
            />
          </Field>
          <Field label="סגנון מטבח">
            <Input
              value={t.cuisineType ?? ""}
              onChange={(v) => set("cuisineType", v)}
              placeholder="פיצה, נאפוליטנה, וגן..."
            />
          </Field>
          <Field label="ח.פ / ע.מ">
            <Input
              value={t.vatNumber ?? ""}
              onChange={(v) => set("vatNumber", v)}
              dir="ltr"
              placeholder="123456789"
            />
          </Field>
          <Field
            label="דומיין מותאם"
            hint="לדוגמה: order.mypizza.co.il (חובה להוסיף ב-DNS בנפרד)."
          >
            <Input
              value={t.customDomain ?? ""}
              onChange={(v) => set("customDomain", v)}
              dir="ltr"
              placeholder="order.example.com"
            />
          </Field>
          <Field label="מקבל מזומן">
            <Toggle
              checked={t.acceptsCash}
              onChange={(v) => set("acceptsCash", v)}
              aria-label="מקבל מזומן"
            />
          </Field>
        </div>
      </Section>

      {/* WhatsApp / iBot */}
      <Section
        title="WhatsApp (iBot Chat)"
        right={
          <span
            className={cn(
              "text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5",
              whatsappConnected
                ? "bg-qf-green-soft text-qf-green-deep"
                : "bg-qf-line-soft text-qf-mute",
            )}
          >
            {whatsappConnected ? "מחובר" : "ברירת מחדל"}
          </span>
        }
      >
        <div className="space-y-3">
          {!whatsappConnected && (
            <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-xs text-qf-ink2">
              שדות ריקים = נשלח דרך חשבון iBot המרכזי של QuickFood (
              <Link href="/admin/settings" className="underline">
                הגדרות פלטפורמה
              </Link>
              ). כדי שהמסעדה תשלח מהמספר שלה - הזן Token + Instance ID משלה.
            </div>
          )}
          <Field
            label="Token (API key / Instance JWT)"
            hint="ה-Instance ID ב-iBot משמש כ-Token לקריאות API."
          >
            <Input
              value={t.whatsappToken ?? ""}
              onChange={(v) => set("whatsappToken", v)}
              dir="ltr"
              placeholder="eyJhbGciOi..."
            />
          </Field>
          <Field
            label="Instance ID / Client ID"
            hint="מזהה ה-instance של חיבור ה-WhatsApp ב-iBot."
          >
            <Input
              value={t.whatsappInstanceId ?? ""}
              onChange={(v) => set("whatsappInstanceId", v)}
              dir="ltr"
              placeholder="abc123-instance"
            />
          </Field>
        </div>
      </Section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-xl bg-qf-ink text-white text-sm font-medium disabled:opacity-60"
        >
          {saving ? "שומר..." : "שמירת שינויים"}
        </button>
      </div>

      {/* Users */}
      <Section title={`משתמשים (${t.users.length})`}>
        <div className="divide-y divide-qf-line-soft">
          {t.users.map((u) => (
            <div
              key={u.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-1.5">
                  {u.name}
                  {u.emailVerifiedAt ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-qf-green-soft text-qf-green-deep font-medium">
                      מאומת
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-qf-tomato-soft text-qf-tomato font-medium">
                      לא מאומת
                    </span>
                  )}
                </div>
                <div
                  className="text-xs text-qf-mute flex items-center gap-2 mt-0.5"
                  dir="ltr"
                >
                  <span className="truncate">{u.email}</span>
                  {u.phone && (
                    <>
                      <span className="text-qf-line">·</span>
                      <span className="tnum shrink-0">{u.phone}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-xs text-qf-mute sm:w-24 shrink-0">
                {ROLE_LABEL[u.role] ?? u.role}
              </div>
              <div className="text-xs text-qf-mute sm:w-40 shrink-0">
                {u.lastLoginAt
                  ? `כניסה אחרונה ${formatDate(u.lastLoginAt)}`
                  : "טרם נכנס"}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 sm:justify-end">
                {u.emailVerifiedAt ? (
                  <button
                    type="button"
                    onClick={() => unverifyEmail(u.id, u.name)}
                    className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-xs hover:bg-qf-line-soft"
                  >
                    ביטול אימות
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => verifyEmail(u.id, u.name)}
                    className="px-3 py-1.5 rounded-lg bg-qf-green-soft text-qf-green-deep text-xs font-medium hover:bg-qf-green-soft/80"
                  >
                    אמת מייל
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => resetPassword(u.id, u.name)}
                  className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-xs hover:bg-qf-line-soft"
                >
                  איפוס סיסמה
                </button>
              </div>
            </div>
          ))}
          {t.users.length === 0 && (
            <div className="py-6 text-center text-sm text-qf-mute">
              אין משתמשים רשומים למסעדה הזו.
            </div>
          )}
        </div>
      </Section>

      {/* Branches */}
      <Section title={`סניפים (${t.branches.length})`}>
        <div className="divide-y divide-qf-line-soft">
          {t.branches.map((b) => (
            <div
              key={b.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {b.name}
                  {b.isPrimary && (
                    <span className="ms-2 text-[10px] uppercase tracking-wide bg-qf-yolk-soft text-qf-ink2 px-1.5 py-0.5 rounded">
                      ראשי
                    </span>
                  )}
                </div>
                <div className="text-xs text-qf-mute">{b.address}</div>
              </div>
              <div className="text-xs text-qf-mute tnum sm:w-40 shrink-0" dir="ltr">
                {b.phone}
              </div>
            </div>
          ))}
          {t.branches.length === 0 && (
            <div className="py-6 text-center text-sm text-qf-mute">
              אין סניפים.
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border border-qf-line-dash p-4">
      <div className="text-xs text-qf-mute">{label}</div>
      <div className="text-2xl font-bold tnum mt-1">{value}</div>
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

function Input({
  value,
  onChange,
  placeholder,
  dir,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: "ltr" | "rtl";
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      disabled={disabled}
      className={cn(
        "w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm",
        disabled && "bg-qf-line-soft text-qf-mute cursor-not-allowed",
      )}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ val: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm bg-white"
    >
      {options.map((o) => (
        <option key={o.val} value={o.val}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

