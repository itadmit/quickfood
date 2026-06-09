import Link from "next/link";
import { TrendingUp, TrendingDown, AlertTriangle, CreditCard, Clock, MessageSquareWarning } from "lucide-react";
import { platformOverview, lifecycleHealth } from "@/lib/admin/analytics";
import type { Range } from "@/lib/analytics";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "היום" },
  { key: "7d", label: "7 ימים" },
  { key: "30d", label: "30 יום" },
];

function parseRange(v: string | undefined): Range {
  return v === "today" || v === "7d" || v === "30d" ? v : "30d";
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range = parseRange(rawRange);

  const [overview, health] = await Promise.all([
    platformOverview(range),
    lifecycleHealth(),
  ]);

  const maxGmv = Math.max(1, ...overview.trend.map((d) => d.gmv));
  const showLabels = overview.trend.length <= 14;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">אנליטיקס פלטפורמה</h1>
          <p className="text-sm text-qf-mute">תמונת מצב חוצת-מסעדות של כל הרשת</p>
        </div>
        <div className="flex gap-1 bg-white rounded-xl border border-qf-line-dash p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin/analytics?range=${r.key}`}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium",
                r.key === range ? "bg-qf-ink text-white" : "text-qf-mute hover:bg-qf-line-soft",
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="מחזור (GMV)"
          value={formatPrice(overview.gmv.value)}
          delta={overview.gmv.delta}
          hint="סך ערך ההזמנות שהושלמו"
        />
        <MetricCard
          label="הזמנות"
          value={overview.orders.value.toLocaleString("he-IL")}
          delta={overview.orders.delta}
          hint="הזמנות שהושלמו בתקופה"
        />
        <MetricCard
          label="מסעדות פעילות"
          value={overview.activeTenants.value.toLocaleString("he-IL")}
          delta={overview.activeTenants.delta}
          hint="לפחות הזמנה אחת בתקופה"
        />
        <MetricCard
          label="נרשמו חדשות"
          value={overview.newSignups.value.toLocaleString("he-IL")}
          delta={overview.newSignups.delta}
          hint="הרשמות חדשות בתקופה"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <HealthCard
          label="ממוצע מחזור למסעדה"
          value={formatPrice(overview.avgGmvPerActive)}
          tone="text-qf-green-deep"
        />
        <HealthCard
          label="ניסיון מסתיים בקרוב"
          value={health.trialsEndingSoon}
          tone="text-qf-ink2"
          icon={<Clock size={15} />}
          hint="עד 3 ימים"
        />
        <HealthCard
          label="ללא הגדרת חיוב"
          value={health.billingNotSetup}
          tone="text-qf-tomato"
          icon={<CreditCard size={15} />}
          hint="פעילות בלי אמצעי תשלום"
        />
        <HealthCard
          label="קרדיט SMS נמוך"
          value={health.lowSmsCredits}
          tone="text-qf-ink2"
          icon={<MessageSquareWarning size={15} />}
          hint="מתחת ל-20"
        />
        <HealthCard
          label="בסיכון נטישה"
          value={health.churnRisk}
          tone="text-qf-tomato"
          icon={<AlertTriangle size={15} />}
          hint="הזמינו פעם, שקטות 14 יום"
        />
      </div>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">מחזור יומי</h2>
          <span className="text-xs text-qf-mute">שיא: {formatPrice(maxGmv)}</span>
        </div>
        {overview.trend.every((d) => d.gmv === 0) ? (
          <div className="py-12 text-center text-sm text-qf-mute">אין הזמנות בתקופה זו</div>
        ) : (
          <div className="flex items-end gap-1.5 h-40" dir="ltr">
            {overview.trend.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1 group min-w-0">
                <div className="text-[9px] text-qf-mute opacity-0 group-hover:opacity-100 tnum whitespace-nowrap">
                  {formatPrice(d.gmv)}
                </div>
                <div
                  className="w-full rounded-t bg-(--qf-primary) min-h-[2px] transition-all"
                  style={{ height: `${Math.round((d.gmv / maxGmv) * 100)}%` }}
                  title={`${d.date} · ${formatPrice(d.gmv)} · ${d.orders} הזמנות`}
                />
                {showLabels && (
                  <div className="text-[9px] text-qf-mute tnum">{d.date.slice(8)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash overflow-hidden">
        <div className="px-5 py-3 border-b border-qf-line-soft bg-qf-line-soft/40">
          <h2 className="font-bold text-sm">מובילות לפי מחזור</h2>
        </div>
        {overview.leaderboard.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-qf-mute">אין נתונים בתקופה זו</div>
        ) : (
          overview.leaderboard.map((t, i) => (
            <Link
              key={t.id}
              href={`/admin/tenants/${t.id}`}
              className="flex items-center gap-3 px-5 py-3 border-b border-qf-line-soft last:border-b-0 hover:bg-qf-line-soft/40"
            >
              <span className="w-6 text-center text-sm font-bold text-qf-mute tnum">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{t.name}</div>
                <div className="text-[11px] text-qf-mute" dir="ltr">/{t.slug}</div>
              </div>
              <div className="text-left">
                <div className="font-bold tnum">{formatPrice(t.gmv)}</div>
                <div className="text-[11px] text-qf-mute tnum">{t.orders} הזמנות</div>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-[11px] text-qf-mute">—</span>;
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium tnum",
        up ? "text-qf-green-deep" : "text-qf-tomato",
      )}
    >
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? "+" : ""}
      {delta}%
    </span>
  );
}

function MetricCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta: number;
  hint: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-qf-line-dash px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-qf-mute">{label}</div>
        <DeltaBadge delta={delta} />
      </div>
      <div className="text-2xl font-bold mt-1 tnum">{value}</div>
      <div className="text-[10px] text-qf-mute mt-0.5">{hint}</div>
    </div>
  );
}

function HealthCard({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  tone: string;
  icon?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-qf-line-dash px-4 py-3">
      <div className="flex items-center gap-1.5 text-qf-mute">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={cn("text-xl font-bold mt-1 tnum", tone)}>{value}</div>
      {hint && <div className="text-[10px] text-qf-mute mt-0.5">{hint}</div>}
    </div>
  );
}
