"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/cn";
import { Phone, LogIn, MessageCircle } from "lucide-react";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  status: string;
  themeId: keyof typeof THEMES;
  cuisineType: string | null;
  plan: string | null;
  ordersCount: number;
  branchesCount: number;
  menuItemsCount: number;
  menuCategoriesCount: number;
  woltCommittedAt: string | null;
  woltItemsImported: number;
  lastLoginAt: string | null;
  lastOrderAt: string | null;
  ownerVerified: boolean;
  ownerPhone: string | null;
  ownerEmail: string | null;
  createdAt: string;
}

type ActivityLevel = "cold" | "setup" | "ready" | "live";

function classifyActivity(t: Tenant): { level: ActivityLevel; label: string; tone: string } {
  if (t.ordersCount > 0) return { level: "live", label: "פעיל · מזמינים", tone: "bg-qf-green-soft text-qf-green-deep" };
  if (t.menuItemsCount > 0) return { level: "ready", label: "תפריט מוכן", tone: "bg-(--qf-soft) text-(--qf-deep)" };
  if (t.lastLoginAt) return { level: "setup", label: "במהלך הקמה", tone: "bg-qf-yolk-soft text-qf-ink2" };
  return { level: "cold", label: "לא נכנס", tone: "bg-qf-line-soft text-qf-mute" };
}

function timeAgo(iso: string | null): string {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "עכשיו";
  if (min < 60) return `לפני ${min} ד׳`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `לפני ${hr} ש׳`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `לפני ${days} י׳`;
  const months = Math.floor(days / 30);
  if (months < 12) return `לפני ${months} ח׳`;
  return `לפני ${Math.floor(months / 12)} ש׳`;
}

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  suspended: "מושעה",
  trial: "ניסיון",
};

export function TenantsList({ tenants }: { tenants: Tenant[] }) {
  const [items] = useState(tenants);
  const [messageTo, setMessageTo] = useState<Tenant | null>(null);

  const counts = {
    total: items.length,
    live: items.filter((t) => t.ordersCount > 0).length,
    ready: items.filter((t) => t.ordersCount === 0 && t.menuItemsCount > 0).length,
    setup: items.filter((t) => t.ordersCount === 0 && t.menuItemsCount === 0 && t.lastLoginAt).length,
    cold: items.filter((t) => !t.lastLoginAt && t.menuItemsCount === 0 && t.ordersCount === 0).length,
    wolt: items.filter((t) => !!t.woltCommittedAt).length,
    unverified: items.filter((t) => !t.ownerVerified).length,
  };

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">לקוחות הפלטפורמה</h1>
          <p className="text-sm text-qf-mute">{counts.total} מסעדות רשומות</p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="px-3.5 py-2 rounded-xl bg-qf-ink text-white text-sm font-medium"
        >
          + לקוח חדש
        </Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="מזמינים בפועל" value={counts.live} tone="text-qf-green-deep" hint="לפחות הזמנה אחת" />
        <StatCard label="תפריט מוכן" value={counts.ready} tone="text-(--qf-deep)" hint="הוסיפו מוצרים, עדיין בלי הזמנה" />
        <StatCard label="באמצע הקמה" value={counts.setup} tone="text-qf-ink2" hint="נכנסו, אין תפריט" />
        <StatCard label="לא נכנסו" value={counts.cold} tone="text-qf-mute" hint="הירשמו ולא חזרו" />
        <StatCard label="ייבאו מוולט" value={counts.wolt} tone="text-qf-ink" hint="פעולת import הושלמה" />
        <StatCard label="אימייל לא מאומת" value={counts.unverified} tone="text-qf-tomato" hint="בעלי החנות שלא לחצו על הלינק" />
      </div>

      <div className="bg-white rounded-2xl border border-qf-line-dash overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.5fr_130px_90px_90px_90px_120px_300px] gap-3 px-5 py-2.5 text-xs font-medium text-qf-mute border-b border-qf-line-soft bg-qf-line-soft/40">
          <div>מסעדה</div>
          <div>פעילות</div>
          <div>תפריט</div>
          <div>הזמנות</div>
          <div>וולט</div>
          <div>כניסה אחרונה</div>
          <div></div>
        </div>
        {items.map((t) => (
          <TenantRow
            key={t.id}
            t={t}
            onMessage={(tn) => setMessageTo(tn)}
          />
        ))}
        {items.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-qf-mute">
            עדיין אין מסעדות. הוסף את הראשונה.
          </div>
        )}
      </div>

      {messageTo && (
        <MessageDialog
          tenant={messageTo}
          onClose={() => setMessageTo(null)}
        />
      )}
    </div>
  );
}

function TenantRow({
  t,
  onMessage,
}: {
  t: Tenant;
  onMessage: (t: Tenant) => void;
}) {
  const theme = THEMES[t.themeId] ?? THEMES.fresh;
  const activity = classifyActivity(t);
  const [impersonating, setImpersonating] = useState(false);

  async function impersonate() {
    if (impersonating) return;
    setImpersonating(true);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${t.id}/impersonate`, {
        method: "POST",
      });
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
      setImpersonating(false);
    } catch {
      setImpersonating(false);
    }
  }

  const statusTone =
    t.status === "active"
      ? "bg-qf-green-soft text-qf-green-deep"
      : t.status === "suspended"
        ? "bg-qf-tomato-soft text-qf-tomato"
        : "bg-qf-yolk-soft text-qf-ink2";

  const nameCell = (
    <Link
      href={`/admin/tenants/${t.id}`}
      className="flex items-center gap-3 min-w-0 group"
    >
      <div
        className="w-10 h-10 rounded-xl grid place-items-center text-white font-bold shrink-0"
        style={{ background: theme.primary }}
      >
        {t.name.slice(0, 2)}
      </div>
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold truncate group-hover:text-(--qf-deep)">
            {t.name}
          </span>
          <span
            className={cn(
              "shrink-0 px-1.5 py-px rounded text-[10px] font-medium",
              statusTone,
            )}
          >
            {STATUS_LABEL[t.status] ?? t.status}
          </span>
        </div>
        <div
          className="text-[11px] text-qf-mute flex items-center gap-1.5 mt-0.5"
          dir="ltr"
        >
          <span className="truncate">/{t.slug}</span>
          {t.ownerPhone && (
            <>
              <span className="text-qf-line">·</span>
              <span className="inline-flex items-center gap-1 text-qf-ink2 tnum shrink-0">
                <Phone size={10} />
                {t.ownerPhone}
              </span>
            </>
          )}
        </div>
        {!t.ownerVerified && (
          <span className="inline-block mt-1 px-1.5 py-px rounded bg-qf-tomato-soft text-qf-tomato text-[10px] font-medium">
            מייל לא אומת
          </span>
        )}
      </div>
    </Link>
  );

  const activityCell = (
    <span
      className={cn(
        "text-xs font-medium px-2 py-0.5 rounded-md inline-block",
        activity.tone,
      )}
    >
      {activity.label}
    </span>
  );

  const menuCell =
    t.menuItemsCount > 0 ? (
      <div className="leading-tight">
        <span className="tnum">{t.menuItemsCount}</span>
        <div className="text-xs text-qf-mute">פריטים</div>
      </div>
    ) : (
      <span className="text-xs text-qf-tomato">אין תפריט</span>
    );

  const ordersCell = (
    <>
      <span className="tnum">{t.ordersCount}</span>
      {t.lastOrderAt && (
        <div className="text-[10px] text-qf-mute">{timeAgo(t.lastOrderAt)}</div>
      )}
    </>
  );

  const woltCell = t.woltCommittedAt ? (
    <div>
      <span className="text-xs bg-qf-green-soft text-qf-green-deep px-2 py-0.5 rounded-md font-medium">
        {t.woltItemsImported || "✓"}
      </span>
      <div className="text-[10px] text-qf-mute mt-0.5">
        {timeAgo(t.woltCommittedAt)}
      </div>
    </div>
  ) : (
    <span className="text-xs text-qf-mute">-</span>
  );

  const lastLoginCell = (
    <>
      {t.lastLoginAt ? (
        timeAgo(t.lastLoginAt)
      ) : (
        <span className="text-qf-tomato">לא נכנס</span>
      )}
      <div className="text-[10px]">נרשמה {formatDate(t.createdAt)}</div>
    </>
  );

  const openLink = (cls: string) => (
    <Link href={`/admin/tenants/${t.id}`} className={cls}>
      פתח
    </Link>
  );

  const impersonateButton = (cls: string) => (
    <button
      type="button"
      onClick={impersonate}
      disabled={impersonating}
      className={cn(cls, "border border-qf-line-dash hover:bg-qf-line-soft inline-flex items-center gap-1 disabled:opacity-50")}
    >
      <LogIn size={13} className="text-qf-mute" />
      {impersonating ? "מתחבר…" : "התחבר כ-"}
    </button>
  );

  const messageButton = (cls: string) => (
    <button
      type="button"
      onClick={() => onMessage(t)}
      className={cn(cls, "border border-qf-line-dash hover:bg-qf-line-soft inline-flex items-center gap-1")}
    >
      <MessageCircle size={13} className="text-qf-mute" />
      שלח הודעה
    </button>
  );

  const actions = (textCls: string) => (
    <>
      {openLink(cn(textCls, "border border-qf-line-dash hover:bg-qf-line-soft"))}
      {impersonateButton(textCls)}
      {messageButton(textCls)}
    </>
  );

  return (
    <>
      {/* Mobile card */}
      <div className="lg:hidden p-4 border-b border-qf-line-soft last:border-b-0 space-y-3">
        <div className="flex items-start justify-between gap-2">
          {nameCell}
          {activityCell}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <LabeledCell label="תפריט">{menuCell}</LabeledCell>
          <LabeledCell label="הזמנות">{ordersCell}</LabeledCell>
          <LabeledCell label="וולט">{woltCell}</LabeledCell>
          <LabeledCell label="כניסה אחרונה">
            <span className="text-qf-mute">{lastLoginCell}</span>
          </LabeledCell>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {actions("px-2.5 py-1.5 rounded-lg text-xs font-medium")}
        </div>
      </div>

      {/* Desktop grid row */}
      <div className="hidden lg:grid grid-cols-[1.5fr_130px_90px_90px_90px_120px_300px] gap-3 px-5 py-3.5 items-start border-b border-qf-line-soft last:border-b-0 hover:bg-qf-line-soft/30 transition-colors">
        {nameCell}
        <div>{activityCell}</div>
        <div className="text-sm">{menuCell}</div>
        <div className="text-sm tnum">{ordersCell}</div>
        <div className="text-sm">{woltCell}</div>
        <div className="text-xs text-qf-mute">{lastLoginCell}</div>
        <div className="flex flex-wrap gap-1.5 justify-end items-center">
          {actions("px-2.5 py-1.5 rounded-lg text-xs font-medium")}
        </div>
      </div>
    </>
  );
}

function LabeledCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-qf-mute mb-0.5">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function StatCard({ label, value, tone, hint }: { label: string; value: number; tone: string; hint: string }) {
  return (
    <div className="bg-white rounded-xl border border-qf-line-dash px-4 py-3">
      <div className={cn("text-2xl font-bold tnum", tone)}>{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
      <div className="text-[10px] text-qf-mute mt-0.5">{hint}</div>
    </div>
  );
}

function defaultMessage(t: Tenant): string {
  return [
    "היי מה קורה?",
    "אני *מישל* מקוויק פוד,",
    "תודה שנרשמת לשירות שלנו! 😀",
    "קוויק פוד מאפשרת לך להקים אתר הזמנות משלך בתוך מספר דקות.",
    "",
    "אשמח ללוות אותך בהקמת החנות, הזנת התפריט והתוספות והחיבור לסליקה.",
    "",
    "בנוסף, מצרפת לך כאן את הלינק לדשבורד ההזמנות:",
    "https://quickfood.co.il/dashboard/",
    "",
    `המייל שלך: ${t.ownerEmail ?? "(לא נמצא מייל)"}`,
    "סיסמה אני לא אשלח כאן, אבל אם אינך זוכר תגיד לי ואחליף סיסמה.",
  ].join("\n");
}

function MessageDialog({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const router = useRouter();
  const [body, setBody] = useState(() => defaultMessage(tenant));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [phone, setPhone] = useState(tenant.ownerPhone ?? "");
  const [savedPhone, setSavedPhone] = useState<string | null>(tenant.ownerPhone);
  const [savingPhone, setSavingPhone] = useState(false);

  const noPhone = !savedPhone;
  const phoneOk = /^0?\d{8,14}$/.test(phone.replace(/[\s-]/g, ""));

  async function savePhone() {
    if (savingPhone || !phoneOk) return;
    setSavingPhone(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${tenant.id}/owner-phone`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? `שגיאה ${res.status}`);
        return;
      }
      setSavedPhone(data?.phone ?? phone.trim());
      router.refresh();
    } catch {
      setError("שגיאת רשת - נסה שוב");
    } finally {
      setSavingPhone(false);
    }
  }

  async function send() {
    if (busy || noPhone || body.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${tenant.id}/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body, to: savedPhone ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? `שגיאה ${res.status}`);
        return;
      }
      setSent(true);
      setTimeout(onClose, 1200);
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
          <div className="mt-0.5 w-9 h-9 rounded-full bg-qf-green-soft flex items-center justify-center shrink-0">
            <MessageCircle size={18} className="text-qf-green-deep" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-base">שליחת הודעה ב-WhatsApp</h2>
            <p className="text-sm text-qf-ink2 mt-1">
              ל<span className="font-semibold text-qf-ink">{tenant.name}</span>
              {savedPhone ? (
                <span className="text-qf-mute tnum" dir="ltr"> · {savedPhone}</span>
              ) : null}
            </p>
          </div>
        </div>

        {noPhone ? (
          <div className="space-y-2">
            <div className="text-sm text-qf-ink2">
              לבעל החנות אין מספר טלפון. הזן מספר ושמור כדי להמשיך.
            </div>
            <div className="flex gap-2">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                dir="ltr"
                placeholder="0501234567"
                className="flex-1 px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm tnum"
              />
              <button
                type="button"
                onClick={savePhone}
                disabled={savingPhone || !phoneOk}
                className="px-3.5 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-50 shrink-0"
              >
                {savingPhone ? "שומר…" : "שמור מספר"}
              </button>
            </div>
          </div>
        ) : (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            dir="rtl"
            className="w-full px-3 py-2 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm leading-relaxed resize-y"
          />
        )}

        {error && (
          <div className="text-sm text-qf-tomato bg-qf-tomato-soft border border-qf-tomato/30 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        {sent && (
          <div className="text-sm text-qf-green-deep bg-qf-green-soft border border-qf-green-deep/20 rounded-xl px-3 py-2">
            ההודעה נשלחה.
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
            onClick={send}
            disabled={busy || noPhone || sent || body.trim().length === 0}
            className="px-3.5 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? "שולח…" : "שלח הודעה"}
          </button>
        </div>
      </div>
    </div>
  );
}

