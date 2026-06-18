"use client";

import { useRouter } from "next/navigation";
import { IcoTrend, IcoSparkle, IcoChart, IcoCheck, IcoWarning } from "@/components/shared/Icons";
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

interface ChannelBucket {
  source: "direct" | "ai_advisor" | "reorder";
  orders: number;
  revenue: number;
  avgOrder: number;
}

interface UpsellStat {
  lineCount: number;
  revenue: number;
  ordersTouched: number;
}

interface Segments {
  new: { customers: number; orders: number; revenue: number };
  returning: { customers: number; orders: number; revenue: number };
  total: { customers: number; orders: number };
}

interface Ops {
  total: number;
  acceptRate: number;
  cancelRate: number;
  avgPrepMinutes: number;
  avgAcceptMinutes: number;
}

interface Insight {
  tone: "strength" | "watch";
  title: string;
  body: string;
  metric?: string;
}

interface VisitorStats {
  visits: KPI;
  unique_visitors: KPI;
  unique_customers: KPI;
}

const RANGES: Array<{ key: "today" | "yesterday" | "7d" | "30d"; label: string }> = [
  { key: "today", label: "היום" },
  { key: "yesterday", label: "אתמול" },
  { key: "7d", label: "7 ימים" },
  { key: "30d", label: "30 ימים" },
];

const CHANNEL_LABELS: Record<ChannelBucket["source"], string> = {
  direct: "ישיר מהתפריט",
  ai_advisor: "יועץ AI",
  reorder: "הזמן שוב",
};

export function AnalyticsView({
  range,
  summary,
  hourly,
  topItems,
  channels,
  segments,
  ops,
  insights,
  visitors,
}: {
  range: "today" | "yesterday" | "7d" | "30d";
  summary: Summary;
  hourly: { current: number[]; previous: number[] };
  topItems: TopItem[];
  channels: { channels: ChannelBucket[]; upsell: UpsellStat };
  segments: Segments;
  ops: Ops;
  insights: Insight[];
  visitors: VisitorStats;
}) {
  const router = useRouter();

  const totalOrders = summary.orders.count ?? 0;
  const maxBar = Math.max(1, ...hourly.current, ...hourly.previous);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hasHourly = hourly.current.some((v) => v > 0);

  const topItemMax = Math.max(1, ...topItems.map((i) => i.count));
  const totalChannelOrders = channels.channels.reduce((a, c) => a + c.orders, 0) || 1;
  const totalChannelRevenue = channels.channels.reduce((a, c) => a + c.revenue, 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">אנליטיקס</h1>
          <p className="text-sm text-black/60 mt-0.5">
            ניתוח עמוק של הביצועים - כספים, ערוצים, לקוחות ותפעול.
          </p>
        </div>
        <div
          className="inline-flex rounded-2xl border-2 border-black overflow-hidden self-start sm:self-auto shadow-[0_3px_0_#000]"
          style={{ backgroundColor: "#FFF2C9" }}
        >
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => router.push(`/dashboard/analytics?range=${r.key}`)}
                className={cn(
                  "px-4 py-2 text-sm font-bold transition",
                  active ? "bg-black text-[#F8CB1E]" : "hover:bg-black/5",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* KPI ROW */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="הכנסות" value={formatPrice(summary.revenue.value ?? 0)} delta={summary.revenue.delta} />
        <KpiCard label="הזמנות" value={String(totalOrders)} delta={summary.orders.delta} />
        <KpiCard label="ממוצע סל" value={formatPrice(summary.avg_order.value ?? 0)} delta={summary.avg_order.delta} />
        <KpiCard
          label="לקוחות חוזרים"
          value={
            segments.total.orders > 0
              ? `${Math.round((segments.returning.orders / segments.total.orders) * 100)}%`
              : "0%"
          }
          delta={null}
          subline={`${segments.returning.customers} מתוך ${segments.total.customers}`}
        />
      </section>

      {/* TRAFFIC ROW - first-party storefront visits */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KpiCard
          label="מבקרים בחנות"
          value={String(visitors.unique_visitors.value ?? 0)}
          delta={visitors.unique_visitors.delta}
          subline="גולשים שונים שנכנסו לאתר"
        />
        <KpiCard
          label="לקוחות מזוהים"
          value={String(visitors.unique_customers.value ?? 0)}
          delta={visitors.unique_customers.delta}
          subline="מתוכם מחוברים לחשבון"
        />
        <KpiCard
          label="כניסות"
          value={String(visitors.visits.value ?? 0)}
          delta={visitors.visits.delta}
          subline="סה״כ פתיחות של האתר"
        />
      </section>

      {/* INSIGHTS - "החוזקות שלך" */}
      {insights.length > 0 && (
        <section
          className="rounded-2xl border-2 border-black p-4 lg:p-5 shadow-[0_3px_0_#000]"
          style={{ backgroundColor: "#FFFBEC" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <IcoSparkle c="#000" s={18} />
            <h2 className="font-black text-lg">החוזקות שלך</h2>
            <span className="text-xs text-black/50 font-medium">
              · בנוי מהנתונים שלך בלבד
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((ins, i) => (
              <InsightCard key={i} insight={ins} />
            ))}
          </div>
        </section>
      )}

      {/* CHANNELS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="ערוצי רכישה" subtitle="איך הלקוחות בנו את ההזמנה">
          {totalOrders === 0 ? (
            <Empty>אין מספיק נתונים בטווח הזה.</Empty>
          ) : (
            <div className="space-y-3 mt-2">
              {channels.channels.map((c) => {
                const share = Math.round((c.orders / totalChannelOrders) * 100);
                return (
                  <div key={c.source}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm font-bold">{CHANNEL_LABELS[c.source]}</span>
                      <span className="text-xs text-black/70 tnum">
                        {c.orders} הזמנות · {formatPrice(c.revenue)} · AOV {formatPrice(c.avgOrder)}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${share}%`,
                          backgroundColor:
                            c.source === "ai_advisor"
                              ? "#0e7a3c"
                              : c.source === "reorder"
                                ? "#c2421f"
                                : "#000",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Upsell בעגלה" subtitle="פריטים שנוספו מקרוסלת ה-Upsell">
          {channels.upsell.lineCount === 0 ? (
            <Empty>עדיין לא היו רכישות מקרוסלת ה-Upsell בטווח הזה.</Empty>
          ) : (
            <div className="space-y-3 mt-2">
              <UpsellRow label="הזמנות שנגעו" value={String(channels.upsell.ordersTouched)} />
              <UpsellRow label="כמות שורות upsell" value={String(channels.upsell.lineCount)} />
              <UpsellRow label="הכנסות מ-upsell" value={formatPrice(channels.upsell.revenue)} />
              {totalChannelRevenue > 0 && (
                <UpsellRow
                  label="חלקו בסך ההכנסה"
                  value={`${Math.round((channels.upsell.revenue / totalChannelRevenue) * 100)}%`}
                />
              )}
            </div>
          )}
        </Panel>
      </section>

      {/* HOURLY HEATMAP */}
      <Panel title="שעות שיא" subtitle="פיזור ההזמנות לאורך היום">
        {!hasHourly ? (
          <Empty>אין הזמנות בטווח הזה.</Empty>
        ) : (
          <div className="mt-3">
            <div className="flex items-end gap-0.5 h-32" dir="ltr">
              {hours.map((h) => {
                const v = hourly.current[h] ?? 0;
                const heightPct = (v / maxBar) * 100;
                const isPeak = v === maxBar && v > 0;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-1 group">
                    <div className="text-[10px] tnum text-black/40 group-hover:text-black">
                      {v > 0 ? v : ""}
                    </div>
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-colors",
                        isPeak ? "bg-black" : "bg-black/30 group-hover:bg-black/50",
                      )}
                      style={{ height: `${heightPct}%`, minHeight: v > 0 ? "4px" : "0px" }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-black/50 tnum" dir="ltr">
              {[0, 6, 12, 18, 23].map((h) => (
                <span key={h}>{h}:00</span>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* TOP ITEMS */}
      <Panel title="פריטים מובילים" subtitle={`לפי כמות במכר · ${range === "7d" ? "7 ימים" : "טווח נבחר"}`}>
        {topItems.length === 0 ? (
          <Empty>אין הזמנות בטווח הזה.</Empty>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {topItems.map((item, i) => {
              const widthPct = Math.round((item.count / topItemMax) * 100);
              return (
                <li key={item.item_id ?? `del-${i}`} className="flex items-center gap-3">
                  <span className="w-6 text-center font-black text-black/40 tnum">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="font-bold text-sm truncate">{item.name}</span>
                      <span className="text-xs text-black/60 tnum shrink-0">
                        {item.count} יח׳ · {formatPrice(item.revenue)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-black/80"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* SEGMENTS + OPS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="לקוחות" subtitle="חדשים מול חוזרים בטווח הזה">
          {segments.total.orders === 0 ? (
            <Empty>אין הזמנות בטווח הזה.</Empty>
          ) : (
            <div className="space-y-3 mt-3">
              <SegmentRow
                label="לקוחות חדשים"
                customers={segments.new.customers}
                orders={segments.new.orders}
                revenue={segments.new.revenue}
                total={segments.total.orders}
                tone="new"
              />
              <SegmentRow
                label="לקוחות חוזרים"
                customers={segments.returning.customers}
                orders={segments.returning.orders}
                revenue={segments.returning.revenue}
                total={segments.total.orders}
                tone="returning"
              />
            </div>
          )}
        </Panel>

        <Panel title="בריאות תפעולית" subtitle="קצב התגובה והאמינות">
          {ops.total === 0 ? (
            <Empty>אין הזמנות בטווח הזה.</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <OpsTile label="אישור" value={`${ops.acceptRate}%`} />
              <OpsTile label="ביטולים" value={`${ops.cancelRate}%`} tone={ops.cancelRate >= 10 ? "warn" : "ok"} />
              <OpsTile label="זמן הכנה" value={ops.avgPrepMinutes > 0 ? `${ops.avgPrepMinutes} דק׳` : "-"} />
              <OpsTile label="זמן עד לאישור" value={ops.avgAcceptMinutes > 0 ? `${ops.avgAcceptMinutes} דק׳` : "-"} />
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  subline,
}: {
  label: string;
  value: string;
  delta: number | null;
  subline?: string;
}) {
  const positive = delta !== null && delta > 0;
  const negative = delta !== null && delta < 0;
  return (
    <div className="bg-white rounded-2xl border-2 border-black p-4 shadow-[0_3px_0_#000]">
      <div className="text-xs font-bold text-black/60 uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-black mt-1 tnum">{value}</div>
      {delta !== null && (
        <div
          className={cn(
            "mt-1 inline-flex items-center gap-1 text-xs font-bold tnum",
            positive && "text-(--qf-deep)",
            negative && "text-qf-tomato",
            !positive && !negative && "text-black/50",
          )}
        >
          <IcoTrend
            c={positive ? "var(--qf-deep)" : negative ? "var(--color-qf-tomato)" : "currentColor"}
            s={12}
            className={negative ? "rotate-180" : undefined}
          />
          {Math.abs(delta)}% מהתקופה הקודמת
        </div>
      )}
      {subline && <div className="text-[11px] text-black/50 mt-1">{subline}</div>}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const isStrength = insight.tone === "strength";
  return (
    <div
      className="bg-white rounded-2xl border-2 border-black p-3.5 shadow-[0_2px_0_#000] flex items-start gap-3"
    >
      <div
        className={cn(
          "min-w-9 h-9 px-2 rounded-xl grid place-items-center font-black text-xs shrink-0 border-2 border-black tnum",
          isStrength ? "bg-(--qf-primary) text-white" : "bg-qf-tomato text-white",
        )}
      >
        {insight.metric ? (
          <span className="whitespace-nowrap">{insight.metric}</span>
        ) : isStrength ? (
          <IcoCheck c="#fff" s={14} />
        ) : (
          <IcoWarning c="#fff" s={14} />
        )}
      </div>
      <div className="min-w-0">
        <div className="font-black text-sm">{insight.title}</div>
        <div className="text-xs text-black/70 mt-0.5 leading-snug">{insight.body}</div>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border-2 border-black p-4 lg:p-5 shadow-[0_3px_0_#000]">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div>
          <h3 className="font-black text-base">{title}</h3>
          {subtitle && (
            <p className="text-xs text-black/55 mt-0.5">{subtitle}</p>
          )}
        </div>
        <IcoChart c="#000" s={18} className="opacity-30" />
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-black/50 py-6 text-center font-medium">
      {children}
    </div>
  );
}

function UpsellRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-black/10 pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-black/70">{label}</span>
      <span className="font-black tnum">{value}</span>
    </div>
  );
}

function SegmentRow({
  label,
  customers,
  orders,
  revenue,
  total,
  tone,
}: {
  label: string;
  customers: number;
  orders: number;
  revenue: number;
  total: number;
  tone: "new" | "returning";
}) {
  const share = total > 0 ? Math.round((orders / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-xs text-black/65 tnum">
          {customers} לקוחות · {orders} הזמנות · {formatPrice(revenue)}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-black/10 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${share}%`,
            backgroundColor: tone === "returning" ? "#0e7a3c" : "#000",
          }}
        />
      </div>
    </div>
  );
}

function OpsTile({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border-2 border-black p-3",
        tone === "warn" ? "bg-qf-tomato-soft" : "bg-black/4",
      )}
    >
      <div className="text-xs font-bold text-black/60">{label}</div>
      <div className="text-xl font-black tnum mt-1">{value}</div>
    </div>
  );
}
