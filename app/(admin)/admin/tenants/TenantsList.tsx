"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/cn";
import { Trash2, AlertTriangle, ExternalLink, Copy, Phone, LogIn, MessageCircle } from "lucide-react";

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
  const router = useRouter();
  const [items, setItems] = useState(tenants);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; step: 1 | 2 } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<Tenant | null>(null);
  const [messageTo, setMessageTo] = useState<Tenant | null>(null);

  async function setStatus(id: string, status: "active" | "suspended") {
    setItems((p) => p.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch(`/api/v1/admin/tenants/${id}/suspend`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${id}`, { method: "DELETE" });
      if (!res.ok) {
        let msg = `שגיאה ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error?.message) msg = body.error.message;
        } catch { /* ignore parse error */ }
        setDeleteError(msg);
        setDeleteConfirm(null);
        return;
      }
      setItems((p) => p.filter((t) => t.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setDeleteError(`המחיקה נכשלה - ${err instanceof Error ? err.message : "נסה שנית"}`);
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  }

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
      {deleteError && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-qf-tomato-soft border border-qf-tomato/30 text-sm text-qf-tomato">
          <span>{deleteError}</span>
          <button type="button" onClick={() => setDeleteError(null)} className="text-qf-tomato/60 hover:text-qf-tomato text-xs">סגור</button>
        </div>
      )}
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
            onSetStatus={setStatus}
            onDelete={(id, name) => setDeleteConfirm({ id, name, step: 1 })}
            onDuplicate={(tn) => setDuplicateOf(tn)}
            onMessage={(tn) => setMessageTo(tn)}
          />
        ))}
        {items.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-qf-mute">
            עדיין אין מסעדות. הוסף את הראשונה.
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 w-9 h-9 rounded-full bg-qf-tomato-soft flex items-center justify-center shrink-0">
                <AlertTriangle size={18} className="text-qf-tomato" />
              </div>
              <div>
                <h2 className="font-bold text-base">מחיקת חנות</h2>
                {deleteConfirm.step === 1 ? (
                  <p className="text-sm text-qf-ink2 mt-1">
                    האם למחוק את <span className="font-semibold text-qf-ink">{deleteConfirm.name}</span>?<br />
                    פעולה זו תמחק את כל הנתונים והתמונות לצמיתות.
                  </p>
                ) : (
                  <p className="text-sm text-qf-tomato font-medium mt-1">
                    אישור אחרון - לא ניתן לבטל. מחק את <span className="font-semibold">{deleteConfirm.name}</span>?
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-3.5 py-2 rounded-xl border border-qf-line-dash text-sm hover:bg-qf-line-soft"
              >
                ביטול
              </button>
              {deleteConfirm.step === 1 ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ ...deleteConfirm, step: 2 })}
                  className="px-3.5 py-2 rounded-xl bg-qf-tomato text-white text-sm font-medium hover:opacity-90"
                >
                  כן, מחק
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-3.5 py-2 rounded-xl bg-qf-tomato text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {deleting ? "מוחק…" : "מחק לצמיתות"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {duplicateOf && (
        <DuplicateDialog
          source={duplicateOf}
          onClose={() => setDuplicateOf(null)}
          onDone={(slug) => {
            setDuplicateOf(null);
            router.refresh();
            window.open(`/s/${slug}`, "_blank", "noopener");
          }}
        />
      )}

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
  onSetStatus,
  onDelete,
  onDuplicate,
  onMessage,
}: {
  t: Tenant;
  onSetStatus: (id: string, status: "active" | "suspended") => void;
  onDelete: (id: string, name: string) => void;
  onDuplicate: (t: Tenant) => void;
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
          <span className="font-medium truncate group-hover:text-(--qf-deep)">
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
      <span className="tnum">
        {t.menuItemsCount} <span className="text-xs text-qf-mute">פריטים</span>
      </span>
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

  const storeLink = (cls: string) => (
    <Link
      href={`/s/${t.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(cls, "border border-qf-line-dash hover:bg-qf-line-soft flex items-center justify-center")}
      title="צפה בחנות"
      aria-label="צפה בחנות"
    >
      <ExternalLink size={14} />
    </Link>
  );

  const statusButton = (cls: string) =>
    t.status === "active" ? (
      <button
        type="button"
        onClick={() => onSetStatus(t.id, "suspended")}
        className={cn(
          cls,
          "border border-qf-tomato/40 text-qf-tomato hover:bg-qf-tomato-soft",
        )}
      >
        השעה
      </button>
    ) : (
      <button
        type="button"
        onClick={() => onSetStatus(t.id, "active")}
        className={cn(cls, "bg-(--qf-primary) text-white")}
      >
        הפעל
      </button>
    );

  const duplicateButton = (cls: string) => (
    <button
      type="button"
      onClick={() => onDuplicate(t)}
      className={cn(cls, "border border-qf-line-dash hover:bg-qf-line-soft flex items-center justify-center")}
      title="שכפל חנות (סניף נוסף)"
      aria-label="שכפל חנות"
    >
      <Copy size={14} />
    </button>
  );

  const deleteButton = (cls: string) => (
    <button
      type="button"
      onClick={() => onDelete(t.id, t.name)}
      className={cn(cls, "border border-qf-tomato/30 text-qf-tomato hover:bg-qf-tomato-soft")}
      title="מחק חנות"
    >
      <Trash2 size={14} />
    </button>
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

  const actions = (textCls: string, iconCls: string) => (
    <>
      {openLink(cn(textCls, "border border-qf-line-dash hover:bg-qf-line-soft"))}
      {impersonateButton(textCls)}
      {messageButton(textCls)}
      {statusButton(textCls)}
      {storeLink(iconCls)}
      {duplicateButton(iconCls)}
      {deleteButton(cn(iconCls, "flex items-center justify-center"))}
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
          {actions("px-2.5 py-1.5 rounded-lg text-xs font-medium", "w-8 h-8 rounded-lg text-xs")}
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
          {actions("px-2.5 py-1.5 rounded-lg text-xs font-medium", "w-7 h-7 rounded-lg text-xs")}
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

function DuplicateDialog({
  source,
  onClose,
  onDone,
}: {
  source: Tenant;
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
  const [body, setBody] = useState(() => defaultMessage(tenant));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const noPhone = !tenant.ownerPhone;

  async function send() {
    if (busy || noPhone || body.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/tenants/${tenant.id}/message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
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
              {tenant.ownerPhone ? (
                <span className="text-qf-mute tnum" dir="ltr"> · {tenant.ownerPhone}</span>
              ) : null}
            </p>
          </div>
        </div>

        {noPhone ? (
          <div className="text-sm text-qf-tomato bg-qf-tomato-soft border border-qf-tomato/30 rounded-xl px-3 py-2">
            לבעל החנות אין מספר טלפון - לא ניתן לשלוח הודעה.
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

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium block">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-qf-mute" dir="auto">{hint}</div>}
    </div>
  );
}
