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
        <div className="grid grid-cols-[1.4fr_140px_120px_120px_120px_120px_120px] gap-3 px-5 py-3 text-xs font-medium text-qf-mute border-b border-qf-line-soft bg-qf-line-soft/40">
          <div>מסעדה</div>
          <div>פעילות</div>
          <div>תפריט</div>
          <div>הזמנות</div>
          <div>וולט</div>
          <div>כניסה אחרונה</div>
          <div></div>
        </div>
        {items.map((t) => {
          const theme = THEMES[t.themeId] ?? THEMES.fresh;
          const activity = classifyActivity(t);
          return (
            <div
              key={t.id}
              className="grid grid-cols-[1.4fr_140px_120px_120px_120px_120px_120px] gap-3 px-5 py-3 items-center border-b border-qf-line-soft last:border-b-0 hover:bg-qf-line-soft/40"
            >
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
                  <div className="text-[11px] text-qf-mute flex items-center gap-1.5 flex-wrap" dir="ltr">
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
              <div>
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-md inline-block", activity.tone)}>
                  {activity.label}
                </span>
              </div>
              <div className="text-sm">
                {t.menuItemsCount > 0 ? (
                  <span className="tnum">
                    {t.menuItemsCount}{" "}
                    <span className="text-xs text-qf-mute">פריטים</span>
                  </span>
                ) : (
                  <span className="text-xs text-qf-tomato">אין תפריט</span>
                )}
              </div>
              <div className="text-sm tnum">
                {t.ordersCount}
                {t.lastOrderAt && (
                  <div className="text-[10px] text-qf-mute">{timeAgo(t.lastOrderAt)}</div>
                )}
              </div>
              <div className="text-sm">
                {t.woltCommittedAt ? (
                  <div>
                    <span className="text-xs bg-qf-green-soft text-qf-green-deep px-2 py-0.5 rounded-md font-medium">
                      {t.woltItemsImported || "✓"}
                    </span>
                    <div className="text-[10px] text-qf-mute mt-0.5">{timeAgo(t.woltCommittedAt)}</div>
                  </div>
                ) : (
                  <span className="text-xs text-qf-mute">-</span>
                )}
              </div>
              <div className="text-xs text-qf-mute">
                {t.lastLoginAt ? timeAgo(t.lastLoginAt) : <span className="text-qf-tomato">לא נכנס</span>}
                <div className="text-[10px]">נרשמה {formatDate(t.createdAt)}</div>
              </div>
              <div className="flex gap-1 justify-end">
                <Link
                  href={`/admin/tenants/${t.id}`}
                  className="px-2.5 py-1 rounded-lg border border-qf-line-dash text-xs hover:bg-qf-line-soft"
                >
                  פתח
                </Link>
                {t.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => setStatus(t.id, "suspended")}
                    className="px-2.5 py-1 rounded-lg border border-qf-tomato/40 text-qf-tomato hover:bg-qf-tomato-soft text-xs"
                  >
                    השעה
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatus(t.id, "active")}
                    className="px-2.5 py-1 rounded-lg bg-(--qf-primary) text-white text-xs"
                  >
                    הפעל
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-qf-mute">
            עדיין אין מסעדות. הוסף את הראשונה.
          </div>
        )}
      </div>
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
