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

type RecentStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "in_oven"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "canceled";

interface RecentOrder {
  id: string;
  number: string;
  status: string;
  method: string;
  total: number;
  customerName: string;
  createdAt: string;
}

const RANGES: Array<{ key: "today" | "yesterday" | "7d" | "30d"; label: string }> = [
  { key: "today", label: "היום" },
  { key: "yesterday", label: "אתמול" },
  { key: "7d", label: "7 ימים" },
  { key: "30d", label: "30 ימים" },
];

export function DashboardView({
  range,
  summary,
  hourly,
  topItems,
  recentOrders,
}: {
  range: "today" | "yesterday" | "7d" | "30d";
  summary: Summary;
  hourly: { current: number[]; previous: number[] };
  topItems: TopItem[];
  recentOrders: RecentOrder[];
}) {
  const router = useRouter();

  const maxBar = Math.max(1, ...hourly.current, ...hourly.previous);
  const hours = Array.from({ length: 13 }, (_, i) => 11 + i);
  const hasHourly = hourly.current.some((v) => v > 0) || hourly.previous.some((v) => v > 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold">דשבורד</h1>
          <p className="text-xs lg:text-sm text-qf-mute">מבט-על על המסעדה</p>
        </div>
        <div className="flex gap-1 bg-white rounded-xl border border-qf-line-dash p-1 self-start sm:self-auto overflow-x-auto no-scrollbar max-w-full">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => router.push(`/dashboard?range=${r.key}`)}
              className={cn(
                "px-3 sm:px-3.5 py-1.5 rounded-lg text-sm transition whitespace-nowrap",
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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
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

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3 lg:gap-4">
        <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
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
          {hasHourly ? (
            <div className="flex items-end gap-1.5 overflow-x-auto no-scrollbar" style={{ height: 192 }}>
              {hours.map((h) => {
                const c = hourly.current[h] ?? 0;
                const p = hourly.previous[h] ?? 0;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center justify-end min-w-7 h-full">
                    <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: 168 }}>
                      <div
                        className="w-2.5 bg-(--qf-primary)/30 rounded-t"
                        style={{ height: `${(p / maxBar) * 168}px` }}
                        title={`${h}:00 prev: ${p}`}
                      />
                      <div
                        className="w-2.5 bg-(--qf-primary) rounded-t"
                        style={{ height: `${(c / maxBar) * 168}px` }}
                        title={`${h}:00 cur: ${c}`}
                      />
                    </div>
                    <div className="text-[10px] text-qf-mute tnum mt-1">{h}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-qf-mute">
              <div className="w-12 h-12 rounded-full bg-qf-line-soft flex items-center justify-center">
                <IcoChart c="#7c8a82" s={22} />
              </div>
              <div className="text-sm">אין עדיין נתונים</div>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
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

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-5">
        <header className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">הזמנות אחרונות</h2>
            <p className="text-xs text-qf-mute">
              {recentOrders.length === 0 ? "אין הזמנות עדיין" : "6 ההזמנות האחרונות"}
            </p>
          </div>
          <Link
            href="/dashboard/orders"
            className="text-sm text-qf-ink2 hover:text-(--qf-deep) transition"
          >
            לכל ההזמנות
          </Link>
        </header>
        {recentOrders.length === 0 ? (
          <div className="text-center text-sm text-qf-mute py-8">עדיין לא התקבלו הזמנות</div>
        ) : (
          <ul className="divide-y divide-qf-line-soft -mx-1">
            {recentOrders.map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 px-1 py-2.5"
              >
                <div className="w-12 text-center">
                  <div className="text-sm font-semibold tnum">#{o.number}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{o.customerName}</div>
                  <div className="text-[11px] text-qf-mute">
                    {o.method === "delivery" ? "משלוח" : "איסוף"} · {formatRelative(o.createdAt)}
                  </div>
                </div>
                <RecentStatusChip status={o.status} />
                <div className="text-sm font-semibold tnum w-20 text-end">
                  {formatPrice(o.total)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
    <div className="bg-white rounded-2xl border border-qf-line-dash p-3 lg:p-4">
      <div className="text-xs text-qf-mute">{label}</div>
      <div className="text-xl lg:text-2xl font-bold mt-1 tnum">{formatted}</div>
      <div className="flex items-center gap-1 mt-1 text-[11px] lg:text-xs">
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
        <span className="text-qf-mute hidden sm:inline">לעומת התקופה הקודמת</span>
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<RecentStatus, string> = {
  pending: "ממתינה",
  confirmed: "אושרה",
  preparing: "בהכנה",
  in_oven: "בתנור",
  ready: "מוכנה",
  out_for_delivery: "בדרך",
  delivered: "נמסרה",
  canceled: "בוטלה",
};

function RecentStatusChip({ status }: { status: string }) {
  const label = STATUS_LABELS[status as RecentStatus] ?? status;
  const tone =
    status === "delivered"
      ? "bg-qf-green-soft text-qf-green-deep"
      : status === "canceled"
        ? "bg-qf-tomato-soft text-qf-tomato"
        : status === "pending"
          ? "bg-qf-warm-dash text-qf-tomato"
          : "bg-qf-line-soft text-qf-ink2";
  return (
    <span className={cn("hidden sm:inline-block text-[10px] font-medium px-2 py-1 rounded-md", tone)}>
      {label}
    </span>
  );
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((now - then) / 60000));
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `לפני ${hrs} שע׳`;
  const days = Math.round(hrs / 24);
  return `לפני ${days} ימים`;
}
