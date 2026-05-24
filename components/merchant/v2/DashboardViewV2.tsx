"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IcoChart, IcoTrend } from "@/components/shared/Icons";
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

/**
 * V2 of the merchant home — same data shape as DashboardView, but
 * rebuilt with the landing-page aesthetic (yellow + bold black borders +
 * hard black drop-shadows). Sandbox-only at /dashboard-v2.
 *
 * Shares formatRelative + STATUS labels with v1; intentionally
 * duplicated rather than imported so the two can drift independently
 * while we iterate.
 */
export function DashboardViewV2({
  range,
  summary,
  hourly,
  topItems,
  recentOrders,
  merchantFirstName,
}: {
  range: "today" | "yesterday" | "7d" | "30d";
  summary: Summary;
  hourly: { current: number[]; previous: number[] };
  topItems: TopItem[];
  recentOrders: RecentOrder[];
  merchantFirstName: string;
}) {
  const router = useRouter();

  const maxBar = Math.max(1, ...hourly.current, ...hourly.previous);
  const hours = Array.from({ length: 13 }, (_, i) => 11 + i);
  const hasHourly =
    hourly.current.some((v) => v > 0) || hourly.previous.some((v) => v > 0);

  return (
    <div className="space-y-5">
      {/* ─── HERO BAND ──────────────────────────────────────────── */}
      <section
        className="relative rounded-3xl overflow-hidden p-6 lg:p-8 border-2 border-black shadow-[0_4px_0_#000]"
        style={{ backgroundColor: "#F8CB1E" }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #000 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 mb-3 text-black/70 text-xs font-semibold">
              <span className="bg-black text-[#F8CB1E] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
                דשבורד
              </span>
              <span>היום אצלך במסעדה</span>
            </div>
            <h1 className="text-black font-black text-3xl lg:text-4xl leading-[1.1]">
              {merchantFirstName ? `שלום ${merchantFirstName},` : "שלום,"}
              <br />
              <span className="bg-black text-[#F8CB1E] px-3 py-0.5 rounded-lg inline-block mt-1.5">
                {kpiHeadline(summary)}
              </span>
            </h1>
          </div>

          {/* Range switcher — black-bordered tabs */}
          <div className="inline-flex bg-white rounded-xl border-2 border-black p-1 self-start sm:self-auto shadow-[0_2px_0_#000]">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => router.push(`/dashboard-v2?range=${r.key}`)}
                className={cn(
                  "px-3 sm:px-3.5 py-1.5 rounded-lg text-sm font-bold transition whitespace-nowrap",
                  range === r.key
                    ? "bg-black text-[#F8CB1E]"
                    : "text-black/70 hover:bg-black/5",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── KPI TILES ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        <KpiTile
          label="הזמנות"
          value={summary.orders.count ?? 0}
          delta={summary.orders.delta}
          accent="yellow"
        />
        <KpiTile
          label="הכנסה"
          value={summary.revenue.value ?? 0}
          delta={summary.revenue.delta}
          format={(v) => formatPrice(v)}
          accent="dark"
        />
        <KpiTile
          label="הזמנה ממוצעת"
          value={summary.avg_order.value ?? 0}
          delta={summary.avg_order.delta}
          format={(v) => formatPrice(v)}
          accent="white"
        />
        <KpiTile
          label="זמן הכנה ממוצע"
          value={summary.avg_prep.value ?? 0}
          delta={summary.avg_prep.delta}
          format={(v) => `${v} דק׳`}
          invertColor
          accent="white"
        />
      </div>

      {/* ─── CHART + TOP ITEMS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3 lg:gap-4">
        <Card>
          <header className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>הזמנות לפי שעה</CardTitle>
              <p className="text-xs text-black/60 mt-1">
                <span className="inline-block w-3 h-3 rounded bg-black align-middle me-1.5" />
                התקופה הנוכחית
                <span className="inline-block w-3 h-3 rounded bg-black/20 align-middle me-1.5 ms-3" />
                התקופה הקודמת
              </p>
            </div>
            <IcoChart c="#000" s={22} />
          </header>
          {hasHourly ? (
            <div className="flex items-end gap-1.5 h-48 overflow-x-auto no-scrollbar">
              {hours.map((h) => {
                const c = hourly.current[h] ?? 0;
                const p = hourly.previous[h] ?? 0;
                return (
                  <div key={h} className="flex-1 flex flex-col items-center min-w-7">
                    <div className="flex-1 flex items-end gap-0.5 w-full justify-center">
                      <div
                        className="w-2.5 bg-black/20 rounded-t"
                        style={{ height: `${(p / maxBar) * 100}%` }}
                        title={`${h}:00 prev: ${p}`}
                      />
                      <div
                        className="w-2.5 bg-black rounded-t"
                        style={{ height: `${(c / maxBar) * 100}%` }}
                        title={`${h}:00 cur: ${c}`}
                      />
                    </div>
                    <div className="text-[10px] text-black/60 tnum mt-1">{h}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="אין עדיין נתונים" />
          )}
        </Card>

        <Card>
          <header className="mb-3">
            <CardTitle>פריטים מובילים</CardTitle>
            <p className="text-xs text-black/60 mt-1">
              {topItems.length === 0 ? "אין נתונים בטווח" : "לפי כמות הזמנות"}
            </p>
          </header>
          {topItems.length === 0 ? (
            <EmptyState text="עוד אין הזמנות בטווח שנבחר" />
          ) : (
            <ol className="space-y-3">
              {topItems.map((it, i) => {
                const max = topItems[0]?.count ?? 1;
                const pct = max > 0 ? (it.count / max) * 100 : 0;
                return (
                  <li key={it.item_id ?? i} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border-2 border-black">
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
                        <div className="text-sm font-bold truncate">{it.name}</div>
                        <div className="text-xs text-black/60 tnum">×{it.count}</div>
                      </div>
                      <div className="h-2 bg-black/10 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-black rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-black/60 tnum mt-0.5">
                        {formatPrice(it.revenue)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>

      {/* ─── RECENT ORDERS ──────────────────────────────────────── */}
      <Card>
        <header className="flex items-center justify-between mb-3">
          <div>
            <CardTitle>הזמנות אחרונות</CardTitle>
            <p className="text-xs text-black/60 mt-1">
              {recentOrders.length === 0
                ? "אין הזמנות עדיין"
                : "6 ההזמנות האחרונות"}
            </p>
          </div>
          <Link
            href="/dashboard/orders"
            className="text-sm font-bold text-black hover:bg-[#F8CB1E] px-2.5 py-1 rounded-lg transition"
          >
            לכל ההזמנות
          </Link>
        </header>
        {recentOrders.length === 0 ? (
          <EmptyState text="עדיין לא התקבלו הזמנות" />
        ) : (
          <ul className="divide-y-2 divide-black/5 -mx-1">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-1 py-2.5">
                <div className="w-12 text-center">
                  <div className="text-sm font-black tnum">#{o.number}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{o.customerName}</div>
                  <div className="text-[11px] text-black/60">
                    {o.method === "delivery" ? "משלוח" : "איסוף"} ·{" "}
                    {formatRelative(o.createdAt)}
                  </div>
                </div>
                <RecentStatusChipV2 status={o.status} />
                <div className="text-sm font-black tnum w-20 text-end">
                  {formatPrice(o.total)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Card primitive — white with bold black border + hard shadow. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border-2 border-black p-4 lg:p-5 shadow-[0_3px_0_#000]">
      {children}
    </section>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-black text-base lg:text-lg">{children}</h2>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-32 flex flex-col items-center justify-center gap-2 text-black/50">
      <div className="w-11 h-11 rounded-full bg-black/5 border-2 border-black/10 grid place-items-center">
        <IcoChart c="rgba(0,0,0,0.4)" s={20} />
      </div>
      <div className="text-sm font-medium">{text}</div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  delta,
  format,
  invertColor,
  accent,
}: {
  label: string;
  value: number;
  delta: number;
  format?: (v: number) => string;
  invertColor?: boolean;
  accent: "yellow" | "dark" | "white";
}) {
  const positive = invertColor ? delta < 0 : delta > 0;
  const formatted = format ? format(value) : value.toLocaleString("he-IL");

  const surface =
    accent === "yellow"
      ? { bg: "#F8CB1E", text: "text-black", subtext: "text-black/70" }
      : accent === "dark"
        ? { bg: "#000", text: "text-white", subtext: "text-white/70" }
        : { bg: "#FFFFFF", text: "text-black", subtext: "text-black/60" };

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-black p-3 lg:p-4 shadow-[0_3px_0_#000]",
        surface.text,
      )}
      style={{ backgroundColor: surface.bg }}
    >
      <div className={cn("text-[11px] font-bold uppercase tracking-wide", surface.subtext)}>
        {label}
      </div>
      <div className="text-2xl lg:text-3xl font-black mt-1 tnum">{formatted}</div>
      <div className="flex items-center gap-1.5 mt-2 text-[11px] lg:text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md tnum font-bold border",
            accent === "dark"
              ? positive
                ? "bg-[#F8CB1E] text-black border-[#F8CB1E]"
                : delta === 0
                  ? "bg-white/15 text-white/80 border-white/20"
                  : "bg-white text-black border-white"
              : positive
                ? "bg-black text-[#F8CB1E] border-black"
                : delta === 0
                  ? "bg-black/10 text-black/60 border-black/10"
                  : "bg-white text-black border-2 border-black",
          )}
        >
          {delta > 0 ? "+" : ""}
          {delta}%
          <IcoTrend c="currentColor" s={10} />
        </span>
      </div>
    </div>
  );
}

const STATUS_LABELS_V2: Record<string, string> = {
  pending: "ממתינה",
  confirmed: "אושרה",
  preparing: "בהכנה",
  in_oven: "בתנור",
  ready: "מוכנה",
  out_for_delivery: "בדרך",
  delivered: "נמסרה",
  canceled: "בוטלה",
};

function RecentStatusChipV2({ status }: { status: string }) {
  const label = STATUS_LABELS_V2[status] ?? status;
  const cls =
    status === "delivered"
      ? "bg-[#F8CB1E] text-black border-black"
      : status === "canceled"
        ? "bg-black text-white border-black"
        : status === "pending"
          ? "bg-white text-black border-black"
          : "bg-white text-black/70 border-black/30";
  return (
    <span
      className={cn(
        "hidden sm:inline-block text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-md border-2",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function kpiHeadline(s: Summary): string {
  const orders = s.orders.count ?? 0;
  if (orders === 0) return "עדיין שקט במטבח";
  if (orders === 1) return "הזמנה אחת בינתיים";
  return `${orders} הזמנות בינתיים`;
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
