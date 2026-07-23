"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Toggle } from "@/components/shared/Toggle";
import { Copy } from "lucide-react";

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
  kioskEnabled: boolean;
  smsCreditsRemaining: number;
  whatsappCreditsRemaining: number;
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
  { val: "pets", label: "בעלי חיים" },
  { val: "grocery", label: "סופר / מכולת" },
  { val: "pharmacy", label: "בית מרקחת / פארם" },
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
  { val: "sunflower", label: "Sunflower" },
  { val: "apricot", label: "Apricot" },
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
  const [showDuplicate, setShowDuplicate] = useState(false);

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
          kiosk_enabled: t.kioskEnabled,
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

  async function patchTrial(payload: Record<string, unknown>, okMsg: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${t.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "שמירה נכשלה");
        return;
      }
      set("trialEndsAt", data?.tenant?.trial_ends_at ?? t.trialEndsAt);
      set(
        "billingSetupCompletedAt",
        data?.tenant?.billing_setup_completed_at ?? t.billingSetupCompletedAt,
      );
      flash(okMsg);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // "2026-07-01" (date input) → end-of-day ISO in the admin's local TZ, so the
  // trial covers the whole chosen day before the gate locks.
  function setTrialDate(value: string) {
    if (!value) {
      patchTrial({ trial_ends_at: null }, "תאריך הניסיון נמחק");
      return;
    }
    const iso = new Date(`${value}T23:59:59`).toISOString();
    patchTrial({ trial_ends_at: iso }, "תאריך סיום הניסיון עודכן");
  }

  function setPaying(paying: boolean) {
    patchTrial(
      { is_paying: paying },
      paying ? "סומן כלקוח משלם" : "הוחזר לסטטוס ניסיון",
    );
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
  const isPaying = t.billingSetupCompletedAt !== null;
  // YYYY-MM-DD for the native date picker (local TZ).
  const trialDateValue = t.trialEndsAt
    ? (() => {
        const d = new Date(t.trialEndsAt);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      })()
    : "";

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
            onClick={() => setShowDuplicate(true)}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-qf-line-dash text-sm hover:bg-qf-line-soft inline-flex items-center gap-1.5"
          >
            <Copy size={14} className="text-qf-mute" />
            שכפל
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
        <Stat label="יתרת SMS" value={t.smsCreditsRemaining} />
        <Stat label="יתרת וואטסאפ" value={t.whatsappCreditsRemaining} />
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

        <div className="mt-4 pt-4 border-t border-qf-line-soft grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">
                {isPaying ? "לקוח משלם" : "לקוח בניסיון"}
              </div>
              <p className="text-xs text-qf-mute mt-0.5">
                כשפעיל, הדשבורד פתוח כלקוח משלם ולא ננעל בתום הניסיון.
              </p>
            </div>
            <Toggle
              checked={isPaying}
              onChange={setPaying}
              disabled={saving}
              aria-label="לקוח משלם"
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="trial-end-date">
              תאריך סיום ניסיון
            </label>
            <input
              id="trial-end-date"
              type="date"
              value={trialDateValue}
              onChange={(e) => setTrialDate(e.target.value)}
              disabled={saving || isPaying}
              dir="ltr"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-qf-line-dash text-sm bg-white disabled:opacity-60"
            />
            <p className="text-xs text-qf-mute mt-1">
              {isPaying
                ? "לא רלוונטי ללקוח משלם."
                : "בחירת תאריך תעדכן מיד את מועד נעילת הדשבורד."}
            </p>
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
          <Field label="עמדת קיוסק" hint="כשפעיל, /s/<slug>/kiosk זמין למסעדה.">
            <Toggle
              checked={t.kioskEnabled}
              onChange={(v) => set("kioskEnabled", v)}
              aria-label="עמדת קיוסק"
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

      {showDuplicate && (
        <DuplicateDialog
          source={{ id: t.id, slug: t.slug, name: t.name }}
          onClose={() => setShowDuplicate(false)}
          onDone={(slug) => {
            setShowDuplicate(false);
            router.refresh();
            window.open(`/s/${slug}`, "_blank", "noopener");
          }}
        />
      )}
    </div>
  );
}

function DuplicateDialog({
  source,
  onClose,
  onDone,
}: {
  source: { id: string; slug: string; name: string };
  onClose: () => void;
  onDone: (slug: string) => void;
}) {
  const [slug, setSlug] = useState(`${source.slug}-2`);
  const [name, setName] = useState(source.name);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugOk = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug);
  const canSubmit =
    slugOk &&
    name.trim().length > 0 &&
    ownerName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(ownerEmail) &&
    ownerPassword.length >= 8;

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${source.id}/duplicate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          name: name.trim(),
          owner: { name: ownerName.trim(), email: ownerEmail.trim().toLowerCase(), password: ownerPassword },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message ?? `שגיאה ${res.status}`);
        return;
      }
      onDone(body.tenant.slug as string);
    } catch {
      setError("שגיאת רשת - נסה שוב");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-full bg-(--qf-soft) flex items-center justify-center shrink-0">
            <Copy size={18} className="text-(--qf-deep)" />
          </div>
          <div>
            <h2 className="font-bold text-base">שכפול חנות</h2>
            <p className="text-sm text-qf-ink2 mt-1">
              משכפל את <span className="font-semibold text-qf-ink">{source.name}</span> לחנות
              חדשה - כל ההגדרות והתפריט. <span className="text-qf-mute">לא כולל תשלום, דומיין, חיוב והזמנות.</span>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Labeled label="שם החנות החדשה">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
            />
          </Labeled>
          <Labeled label="כתובת (slug)" hint={slugOk ? `quickfood.co.il/s/${slug}` : "אותיות קטנות, ספרות ומקפים"}>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              dir="ltr"
              className={cn(
                "w-full px-3 py-2 rounded-xl border outline-none text-sm",
                slug && !slugOk ? "border-qf-tomato" : "border-qf-line-dash focus:border-(--qf-primary)",
              )}
            />
          </Labeled>

          <div className="pt-1 border-t border-qf-line-soft">
            <div className="text-xs font-semibold text-qf-mute mt-3 mb-2">בעלים לחנות החדשה (לוגין נפרד)</div>
            <div className="space-y-3">
              <Labeled label="שם הבעלים">
                <input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
                />
              </Labeled>
              <Labeled label="אימייל" hint="חייב להיות שונה מהבעלים של המקור">
                <input
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  type="email"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
                />
              </Labeled>
              <Labeled label="סיסמה" hint="לפחות 8 תווים">
                <input
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  type="text"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm"
                />
              </Labeled>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-sm text-qf-tomato bg-qf-tomato-soft border border-qf-tomato/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3.5 py-2 rounded-xl border border-qf-line-dash text-sm hover:bg-qf-line-soft"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || busy}
            className="px-3.5 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? "משכפל…" : "שכפל חנות"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium block">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-qf-mute" dir="auto">{hint}</div>}
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

