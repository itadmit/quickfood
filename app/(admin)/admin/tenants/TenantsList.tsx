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
  createdAt: string;
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

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">לקוחות הפלטפורמה</h1>
          <p className="text-sm text-qf-mute">{items.length} מסעדות רשומות</p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="px-3.5 py-2 rounded-xl bg-qf-ink text-white text-sm font-medium"
        >
          + לקוח חדש
        </Link>
      </header>

      <div className="bg-white rounded-2xl border border-qf-line-dash overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px_100px_120px_140px] gap-3 px-5 py-3 text-xs font-medium text-qf-mute border-b border-qf-line-soft bg-qf-line-soft/40">
          <div>מסעדה</div>
          <div>תוכנית</div>
          <div>סטטוס</div>
          <div>הזמנות</div>
          <div>נרשמה</div>
          <div></div>
        </div>
        {items.map((t) => {
          const theme = THEMES[t.themeId] ?? THEMES.fresh;
          return (
            <div
              key={t.id}
              className="grid grid-cols-[1fr_120px_120px_100px_120px_140px] gap-3 px-5 py-3 items-center border-b border-qf-line-soft last:border-b-0 hover:bg-qf-line-soft/40"
            >
              <Link
                href={`/admin/tenants/${t.id}`}
                className="flex items-center gap-3 min-w-0 group"
              >
                <div
                  className="w-10 h-10 rounded-xl grid place-items-center text-white font-bold"
                  style={{ background: theme.primary }}
                >
                  {t.name.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate group-hover:text-(--qf-deep)">
                    {t.name}
                  </div>
                  <div className="text-xs text-qf-mute" dir="ltr">
                    /{t.slug}
                  </div>
                </div>
              </Link>
              <div className="text-sm">{t.plan ?? "—"}</div>
              <div>
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
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
              <div className="text-sm tnum">{t.ordersCount}</div>
              <div className="text-xs text-qf-mute">{formatDate(t.createdAt)}</div>
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
