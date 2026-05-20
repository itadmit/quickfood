"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IcoTrend, IcoChart } from "@/components/shared/Icons";
import { MenuItemImage } from "@/components/shared/MenuItemImage";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface KPI {
  count?: number;
  value?: number;
  delta: number;
}

interface Summary {
  range: string;
  orders: KPI;
  revenue: KPI;
  avg_order: KPI;
  avg_prep: KPI;
}

interface TopItem {
  item_id: string | null;
  name: string;
  art_type: string | null;
  count: number;
  revenue: number;
}

const RANGES: Array<{ key: "today" | "yesterday" | "7d" | "30d"; label: string }> = [
  { key: "today", label: "היום" },
  { key: "yesterday", label: "אתמול" },
  { key: "7d", label: "7 ימים" },
  { key: "30d", label: "30 ימים" },
];

export function AnalyticsView({
  range,
  summary,
  hourly,
  topItems,
}: {
  range: "today" | "yesterday" | "7d" | "30d";
  summary: Summary;
  hourly: { current: number[]; previous: number[] };
  topItems: TopItem[];
}) {
  const router = useRouter();

  const maxBar = Math.max(1, ...hourly.current, ...hourly.previous);
  const hours = Array.from({ length: 13 }, (_, i) => 11 + i); // 11:00–23:00

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">אנליטיקה</h1>
          <p className="text-sm text-qf-mute">סטטיסטיקות מסעדה ומגמות</p>
        </div>
        <div className="flex gap-1 bg-white rounded-xl border border-qf-line-dash p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => router.push(`/dashboard/analytics?range=${r.key}`)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-sm transition",
                range === r.key
                  ? "bg-(--qf-primary) text-white"
                  : "text-qf-ink2 hover:bg-qf-line-soft",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="הזמנות" value={summary.orders.count ?? 0} delta={summary.orders.delta} />
        <KpiCard
          label="הכנסה"
          value={summary.revenue.value ?? 0}
          delta={summary.revenue.delta}
          format={(v) => formatPrice(v)}
        />
        <KpiCard
          label="הזמנה ממוצעת"
          value={summary.avg_order.value ?? 0}
          delta={summary.avg_order.delta}
          format={(v) => formatPrice(v)}
        />
        <KpiCard
          label="זמן הכנה ממוצע"
          value={summary.avg_prep.value ?? 0}
          delta={summary.avg_prep.delta}
          format={(v) => `${v} דק׳`}
          invertColor
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
        <section className="bg-white rounded-2xl border border-qf-line-dash p-5">
          <header className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">הזמנות לפי שעה</h2>
              <p className="text-xs text-qf-mute">
                <span className="inline-block w-3 h-3 rounded bg-(--qf-primary) align-middle me-1.5" />
                התקופה הנוכחית
                <span className="inline-block w-3 h-3 rounded bg-(--qf-primary)/30 align-middle me-1.5 ms-3" />
                התקופה הקודמת
              </p>
            </div>
            <IcoChart c="#7c8a82" s={20} />
          </header>
          <div className="flex items-end gap-1.5 h-48 overflow-x-auto no-scrollbar">
            {hours.map((h) => {
              const c = hourly.current[h] ?? 0;
              const p = hourly.previous[h] ?? 0;
              return (
                <div key={h} className="flex-1 flex flex-col items-center min-w-[28px]">
                  <div className="flex-1 flex items-end gap-0.5 w-full justify-center">
                    <div
                      className="w-2.5 bg-(--qf-primary)/30 rounded-t"
                      style={{ height: `${(p / maxBar) * 100}%` }}
                      title={`${h}:00 prev: ${p}`}
                    />
                    <div
                      className="w-2.5 bg-(--qf-primary) rounded-t"
                      style={{ height: `${(c / maxBar) * 100}%` }}
                      title={`${h}:00 cur: ${c}`}
                    />
                  </div>
                  <div className="text-[10px] text-qf-mute tnum mt-1">{h}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-qf-line-dash p-5">
          <header className="mb-3">
            <h2 className="font-semibold">פריטים מובילים</h2>
            <p className="text-xs text-qf-mute">{topItems.length === 0 ? "אין נתונים בטווח" : "לפי כמות הזמנות"}</p>
          </header>
          {topItems.length === 0 ? (
            <div className="text-center text-sm text-qf-mute py-8">
              עוד אין הזמנות בטווח שנבחר
            </div>
          ) : (
            <ol className="space-y-3">
              {topItems.map((it, i) => {
                const max = topItems[0]?.count ?? 1;
                const pct = max > 0 ? (it.count / max) * 100 : 0;
                return (
                  <li key={it.item_id ?? i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
                      <MenuItemImage
                        src={null}
                        alt={it.name}
                        businessType="general"
                        size={36}
                        rounded="lg"
                        className="w-full h-full"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-sm font-medium truncate">{it.name}</div>
                        <div className="text-xs text-qf-mute tnum">×{it.count}</div>
                      </div>
                      <div className="h-1.5 bg-qf-line-soft rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-(--qf-primary) rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-qf-mute tnum mt-0.5">
                        {formatPrice(it.revenue)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <p className="text-xs text-qf-mute text-center">
        <Link href="/api/v1/openapi" target="_blank" className="underline">
          API
        </Link>
        : /api/v1/merchant/analytics/summary?range={range}
      </p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  format,
  invertColor,
}: {
  label: string;
  value: number;
  delta: number;
  format?: (v: number) => string;
  invertColor?: boolean;
}) {
  const positive = invertColor ? delta < 0 : delta > 0;
  const formatted = format ? format(value) : value.toLocaleString("he-IL");
  return (
    <div className="bg-white rounded-2xl border border-qf-line-dash p-4">
      <div className="text-xs text-qf-mute">{label}</div>
      <div className="text-2xl font-bold mt-1 tnum">{formatted}</div>
      <div className="flex items-center gap-1 mt-1 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md tnum",
            positive
              ? "bg-qf-green-soft text-qf-green-deep"
              : delta === 0
                ? "bg-qf-line-soft text-qf-mute"
                : "bg-qf-tomato-soft text-qf-tomato",
          )}
        >
          {delta > 0 ? "+" : ""}
          {delta}%
          <IcoTrend c={positive ? "var(--qf-primary)" : "#c2421f"} s={10} />
        </span>
        <span className="text-qf-mute">לעומת התקופה הקודמת</span>
      </div>
    </div>
  );
}
