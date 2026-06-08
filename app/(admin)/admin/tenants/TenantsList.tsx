"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";
import { THEMES } from "@/lib/themes";
import { cn } from "@/lib/cn";

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

  async function setStatus(id: string, status: "active" | "suspended") {
    setItems((p) => p.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch(`/api/v1/admin/tenants/${id}/suspend`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
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
        <div className="hidden lg:grid grid-cols-[1.4fr_140px_120px_120px_120px_120px_120px] gap-3 px-5 py-3 text-xs font-medium text-qf-mute border-b border-qf-line-soft bg-qf-line-soft/40">
          <div>מסעדה</div>
          <div>פעילות</div>
          <div>תפריט</div>
          <div>הזמנות</div>
          <div>וולט</div>
          <div>כניסה אחרונה</div>
          <div></div>
        </div>
        {items.map((t) => (
          <TenantRow key={t.id} t={t} onSetStatus={setStatus} />
        ))}
        {items.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-qf-mute">
            עדיין אין מסעדות. הוסף את הראשונה.
          </div>
        )}
      </div>
    </div>
  );
}

function TenantRow({
  t,
  onSetStatus,
}: {
  t: Tenant;
  onSetStatus: (id: string, status: "active" | "suspended") => void;
}) {
  const theme = THEMES[t.themeId] ?? THEMES.fresh;
  const activity = classifyActivity(t);

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
      <div className="min-w-0">
        <div className="font-medium truncate group-hover:text-(--qf-deep)">
          {t.name}
        </div>
        <div
          className="text-[11px] text-qf-mute flex items-center gap-1.5 flex-wrap"
          dir="ltr"
        >
          <span>/{t.slug}</span>
          <span>·</span>
          <span
            className={cn(
              "px-1.5 py-px rounded",
              t.status === "active"
                ? "bg-qf-green-soft text-qf-green-deep"
                : t.status === "suspended"
                  ? "bg-qf-tomato-soft text-qf-tomato"
                  : "bg-qf-yolk-soft text-qf-ink2",
            )}
          >
            {STATUS_LABEL[t.status] ?? t.status}
          </span>
          {!t.ownerVerified && (
            <span className="px-1.5 py-px rounded bg-qf-tomato-soft text-qf-tomato font-medium">
              מייל לא אומת
            </span>
          )}
        </div>
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
        <div className="flex gap-2">
          {openLink(
            "flex-1 text-center px-2.5 py-1.5 rounded-lg border border-qf-line-dash text-xs hover:bg-qf-line-soft",
          )}
          {statusButton("flex-1 text-center px-2.5 py-1.5 rounded-lg text-xs font-medium")}
        </div>
      </div>

      {/* Desktop grid row */}
      <div className="hidden lg:grid grid-cols-[1.4fr_140px_120px_120px_120px_120px_120px] gap-3 px-5 py-3 items-center border-b border-qf-line-soft last:border-b-0 hover:bg-qf-line-soft/40">
        {nameCell}
        <div>{activityCell}</div>
        <div className="text-sm">{menuCell}</div>
        <div className="text-sm tnum">{ordersCell}</div>
        <div className="text-sm">{woltCell}</div>
        <div className="text-xs text-qf-mute">{lastLoginCell}</div>
        <div className="flex gap-1 justify-end">
          {openLink(
            "px-2.5 py-1 rounded-lg border border-qf-line-dash text-xs hover:bg-qf-line-soft",
          )}
          {statusButton("px-2.5 py-1 rounded-lg text-xs")}
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
