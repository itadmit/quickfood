"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IcoChart, IcoTrend, IcoArrowLeft, IcoMenuBook, IcoGear, IcoCheck, IcoMenuList, IcoClock, IcoCreditCard, IcoArrowRight, IcoClose } from "@/components/shared/Icons";
import { Modal } from "@/components/shared/Modal";
import { GrowNudgeModal } from "@/components/merchant/v2/GrowNudgeModal";
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
 * V2 of the merchant home - same data shape as DashboardView, but
 * rebuilt with the landing-page aesthetic (yellow + bold black borders +
 * hard black drop-shadows). Rendered when tenant.dashboardVersion === "v2".
 *
 * Shares formatRelative + STATUS labels with v1; intentionally
 * duplicated rather than imported so the two can drift independently
 * while we iterate.
 */
type DayHours = { open: string; close: string; active: boolean };

const WIZARD_DAYS = [
  { key: "sunday", label: "ראשון" },
  { key: "monday", label: "שני" },
  { key: "tuesday", label: "שלישי" },
  { key: "wednesday", label: "רביעי" },
  { key: "thursday", label: "חמישי" },
  { key: "friday", label: "שישי" },
  { key: "saturday", label: "שבת" },
] as const;

const DEFAULT_HOURS: DayHours = { open: "11:00", close: "23:00", active: true };

interface SetupState {
  brandingDone: boolean;
  categoriesDone: boolean;
  menuItemsDone: boolean;
  branchId: string | null;
  initialStoreName: string;
  initialCuisineType: string;
  initialBranchName: string;
  initialBranchAddress: string;
  initialBranchPhone: string;
  initialMinOrder: number;
  initialDeliveryFee: number;
  initialAcceptsCash: boolean;
  initialGrowActive: boolean;
  initialGrowUserId: string;
  initialBranchHours: Record<string, DayHours>;
}

export function DashboardViewV2({
  range,
  summary,
  hourly,
  topItems,
  recentOrders,
  merchantFirstName,
  hasNoMenuItems = false,
  setupState,
}: {
  range: "today" | "yesterday" | "7d" | "30d";
  summary: Summary;
  hourly: { current: number[]; previous: number[] };
  topItems: TopItem[];
  recentOrders: RecentOrder[];
  merchantFirstName: string;
  hasNoMenuItems?: boolean;
  setupState?: SetupState;
}) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(false);

  const maxBar = Math.max(1, ...hourly.current, ...hourly.previous);
  const hours = Array.from({ length: 13 }, (_, i) => 11 + i);
  const hasHourly =
    hourly.current.some((v) => v > 0) || hourly.previous.some((v) => v > 0);

  return (
    <div className="space-y-5">
      {/* ─── HERO BAND ──────────────────────────────────────────── */}
      {/* The one place we lean into the bold treatment fully. Dot
          pattern dialed back so the chip + headline carry the energy
          on their own. */}
      <section
        className="relative rounded-3xl overflow-hidden p-6 lg:p-8 border-2 border-black shadow-[0_3px_0_#000]"
        style={{ backgroundColor: "#F8CB1E" }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #000 1px, transparent 1px)",
            backgroundSize: "22px 22px",
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

          {/* Range switcher - black-bordered tabs */}
          <div className="inline-flex bg-white rounded-xl border-2 border-black p-1 self-start sm:self-auto shadow-[0_2px_0_#000]">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => router.push(`/dashboard?range=${r.key}`)}
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

      {/* ─── GROW CLEARING NUDGE ────────────────────────────────── */}
      {/* Menu already started but no active clearing - one-time popup
          pushing the Grow quick-signup form. */}
      {!hasNoMenuItems && setupState && !setupState.initialGrowActive && (
        <GrowNudgeModal />
      )}

      {/* ─── SETUP WIZARD TRIGGER ───────────────────────────────── */}
      {hasNoMenuItems && setupState && (
        <>
          <SetupTrigger
            state={setupState}
            onOpen={() => setWizardOpen(true)}
          />
          {wizardOpen && (
            <SetupWizardModal
              state={setupState}
              onClose={() => setWizardOpen(false)}
            />
          )}
        </>
      )}

      {/* ─── KPI TILES ──────────────────────────────────────────── */}
      {/* Quiet by default - only the "primary" KPI (orders) wears the
          full bold treatment, the rest sit as restrained white cards
          with a tiny yellow rule on top as the only color cue. Avoids
          the "4 mini-heroes competing with the actual hero" trap. */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        <KpiTile
          label="הזמנות"
          value={summary.orders.count ?? 0}
          delta={summary.orders.delta}
          accent="primary"
        />
        <KpiTile
          label="הכנסה"
          value={summary.revenue.value ?? 0}
          delta={summary.revenue.delta}
          format={(v) => formatPrice(v)}
          accent="quiet"
        />
        <KpiTile
          label="הזמנה ממוצעת"
          value={summary.avg_order.value ?? 0}
          delta={summary.avg_order.delta}
          format={(v) => formatPrice(v)}
          accent="quiet"
        />
        <KpiTile
          label="זמן הכנה ממוצע"
          value={summary.avg_prep.value ?? 0}
          delta={summary.avg_prep.delta}
          format={(v) => `${v} דק׳`}
          invertColor
          accent="quiet"
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

/** Card primitive - quiet surface that lets the hero do the talking.
    The bold-black-shadow treatment is reserved for the hero + the
    primary KPI tile + the active sidebar item. Reusing it on every
    card was visually exhausting. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-black/10 p-4 lg:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {children}
    </section>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-bold text-base lg:text-lg">{children}</h2>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-32 flex flex-col items-center justify-center gap-2.5 text-black/70">
      <div className="w-12 h-12 rounded-2xl bg-white border-2 border-black grid place-items-center shadow-[0_2px_0_#000]">
        <IcoChart c="#000" s={20} />
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
  /**
   * "primary" = the one KPI we want eyes on first (currently orders).
   * Wears the full bold treatment: yellow surface, black border, hard
   * shadow. "quiet" = white card with a thin yellow rule on top as the
   * only color cue - keeps the grid from looking like 4 mini-heroes.
   */
  accent: "primary" | "quiet";
}) {
  const positive = invertColor ? delta < 0 : delta > 0;
  const formatted = format ? format(value) : value.toLocaleString("he-IL");

  if (accent === "primary") {
    return (
      <div
        className="rounded-2xl border-2 border-black p-3 lg:p-4 shadow-[0_3px_0_#000] text-black"
        style={{ backgroundColor: "#F8CB1E" }}
      >
        <div className="text-[11px] font-bold uppercase tracking-wide text-black/70">
          {label}
        </div>
        <div className="text-2xl lg:text-3xl font-black mt-1 tnum">{formatted}</div>
        <div className="flex items-center gap-1.5 mt-2 text-[11px] lg:text-xs">
          <DeltaPill delta={delta} positive={positive} variant="onYellow" />
        </div>
      </div>
    );
  }

  // Quiet variant - small yellow rule along the top edge is the only
  // brand cue. Border + shadow as faint as the regular Card.
  return (
    <div className="relative bg-white rounded-2xl border border-black/10 p-3 lg:p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-0.75"
        style={{ backgroundColor: "#F8CB1E" }}
        aria-hidden
      />
      <div className="text-[11px] font-bold uppercase tracking-wide text-black/55">
        {label}
      </div>
      <div className="text-2xl lg:text-3xl font-black mt-1 tnum">{formatted}</div>
      <div className="flex items-center gap-1.5 mt-2 text-[11px] lg:text-xs">
        <DeltaPill delta={delta} positive={positive} variant="onWhite" />
      </div>
    </div>
  );
}

function DeltaPill({
  delta,
  positive,
  variant,
}: {
  delta: number;
  positive: boolean;
  variant: "onYellow" | "onWhite";
}) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-black/55 bg-black/5">
        0%
      </span>
    );
  }
  const onYellow = variant === "onYellow";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md tnum font-bold",
        positive
          ? onYellow
            ? "bg-black text-[#F8CB1E]"
            : "bg-black text-[#F8CB1E]"
          : onYellow
            ? "bg-white text-black border border-black"
            : "bg-black/5 text-black",
      )}
    >
      {delta > 0 ? "+" : ""}
      {delta}%
      <IcoTrend c="currentColor" s={10} />
    </span>
  );
}

// Each status maps to a visual semantic in the cyan/black/white palette.
// The system reads at a glance:
//   • white + black border  = idle (waiting on someone)
//   • cyan + black border   = active right now (kitchen in motion)
//   • dot prefix            = en route (movement implied)
//   • black + cyan text     = done well (success)
//   • dashed + muted        = canceled (closed unsuccessfully)
const STATUS_META: Record<
  string,
  { label: string; tone: "idle" | "active" | "transit" | "done" | "canceled" }
> = {
  pending: { label: "ממתינה", tone: "idle" },
  confirmed: { label: "אושרה", tone: "idle" },
  preparing: { label: "בהכנה", tone: "active" },
  in_oven: { label: "בתנור", tone: "active" },
  ready: { label: "מוכנה", tone: "active" },
  out_for_delivery: { label: "בדרך", tone: "transit" },
  delivered: { label: "נמסרה", tone: "done" },
  canceled: { label: "בוטלה", tone: "canceled" },
};

function RecentStatusChipV2({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, tone: "idle" as const };

  const base =
    "hidden sm:inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide px-2 py-1 rounded-md border-2";

  if (meta.tone === "active") {
    return (
      <span
        className={cn(base, "border-black text-black")}
        style={{ backgroundColor: "#F8CB1E" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
        {meta.label}
      </span>
    );
  }

  if (meta.tone === "transit") {
    return (
      <span className={cn(base, "border-black bg-white text-black")}>
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: "#F8CB1E" }}
        />
        {meta.label}
      </span>
    );
  }

  if (meta.tone === "done") {
    return (
      <span
        className={cn(base, "border-black bg-black")}
        style={{ color: "#F8CB1E" }}
      >
        {meta.label}
      </span>
    );
  }

  if (meta.tone === "canceled") {
    return (
      <span
        className={cn(
          base,
          "border-dashed border-black/30 bg-transparent text-black/45 line-through decoration-black/40",
        )}
      >
        {meta.label}
      </span>
    );
  }

  // idle (pending, confirmed) - clean black-bordered white pill
  return (
    <span className={cn(base, "border-black bg-white text-black")}>
      {meta.label}
    </span>
  );
}

function kpiHeadline(s: Summary): string {
  const orders = s.orders.count ?? 0;
  if (orders === 0) return "עדיין שקט במטבח";
  if (orders === 1) return "הזמנה אחת בינתיים";
  return `${orders} הזמנות בינתיים`;
}

function SetupTrigger({ state, onOpen }: { state: SetupState; onOpen: () => void }) {
  const stepDefs = [
    { label: "זהות", done: state.brandingDone || !!state.initialCuisineType },
    { label: "סניף", done: !!state.initialBranchAddress && !!state.initialBranchPhone },
    { label: "הזמנות", done: state.initialMinOrder > 0 || state.initialDeliveryFee > 0 },
    { label: "תפריט", done: state.categoriesDone },
  ];
  const doneCount = stepDefs.filter((s) => s.done).length;
  const total = stepDefs.length;

  return (
    <div className="rounded-2xl border-2 border-black bg-white shadow-[0_3px_0_#000] overflow-hidden animate-qf-empty-nudge" dir="rtl">
      <div className="flex items-start gap-4 p-4 lg:p-5">
        <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#F8CB1E] border-2 border-black grid place-items-center shadow-[0_2px_0_#000] mt-0.5">
          <IcoMenuBook c="#000" s={22} />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <div className="font-black text-base text-black">הקמת החנות</div>
            <div className="text-xs text-black/55 mt-0.5">
              {doneCount === 0
                ? "בואו נגדיר את החנות יחד — 5 דקות ואתם מוכנים"
                : `${doneCount} מתוך ${total} שלבים הושלמו`}
            </div>
          </div>
          <div className="relative flex gap-1">
            <div className="absolute inset-x-3 top-[11px] h-0.5 bg-black/12" aria-hidden />
            {stepDefs.map(({ label, done }, i) => (
              <div key={i} className="relative flex-1 flex flex-col items-center gap-1.5">
                <div className={cn(
                  "relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition shrink-0",
                  done ? "bg-black border-black" : "bg-white border-black/25",
                )}>
                  {done
                    ? <IcoCheck c="#F8CB1E" s={10} />
                    : <span className="text-[9px] font-black text-black/35 leading-none">{i + 1}</span>}
                </div>
                <span className={cn(
                  "text-[10px] font-bold leading-tight text-center",
                  done ? "text-black" : "text-black/35",
                )}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="shrink-0 mt-0.5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-black text-[#F8CB1E] font-black text-sm border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-none transition"
        >
          {doneCount === 0 ? "התחל הגדרה" : "המשך הגדרה"}
          <IcoArrowLeft c="currentColor" s={14} />
        </button>
      </div>
    </div>
  );
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const WIZARD_STEPS: { n: WizardStep; label: string }[] = [
  { n: 1, label: "זהות" },
  { n: 2, label: "פרטי קשר" },
  { n: 3, label: "הזמנות" },
  { n: 4, label: "תשלומים" },
  { n: 5, label: "תפריט" },
];

function SetupWizardModal({ state, onClose }: { state: SetupState; onClose: () => void }) {
  const router = useRouter();

  const initialStep: WizardStep = (() => {
    if (!state.initialBranchAddress || !state.initialBranchPhone) return 2;
    if (!state.initialCuisineType && !state.brandingDone) return 1;
    if (state.initialMinOrder === 0 && state.initialDeliveryFee === 0) return 3;
    if (!state.categoriesDone) return 5;
    return 1;
  })();

  const [step, setStep] = useState<WizardStep>(initialStep);

  const [storeName, setStoreName] = useState(state.initialStoreName);
  const [cuisineType, setCuisineType] = useState(state.initialCuisineType);
  const [branchAddress, setBranchAddress] = useState(state.initialBranchAddress);
  const [branchPhone, setBranchPhone] = useState(state.initialBranchPhone);
  const [minOrder, setMinOrder] = useState(state.initialMinOrder);
  const [deliveryFee, setDeliveryFee] = useState(state.initialDeliveryFee);
  const [acceptsCash, setAcceptsCash] = useState(state.initialAcceptsCash);
  const [growActive, setGrowActive] = useState(state.initialGrowActive);
  const [growUserId, setGrowUserId] = useState(state.initialGrowUserId);
  const [wizardHours, setWizardHours] = useState<Record<string, DayHours>>(() => {
    const out: Record<string, DayHours> = {};
    for (const d of WIZARD_DAYS) out[d.key] = state.initialBranchHours[d.key] ?? DEFAULT_HOURS;
    return out;
  });
  const [categoryName, setCategoryName] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function prev() {
    setErr(null);
    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  }

  async function saveIdentity() {
    if (!storeName.trim()) { setErr("שם החנות הוא שדה חובה"); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/v1/merchant/tenant", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: storeName.trim(), cuisine_type: cuisineType || undefined }),
      });
      if (!res.ok) throw new Error();
      setStep(2);
    } catch { setErr("שמירה נכשלה, נסה שנית"); }
    finally { setBusy(false); }
  }

  async function saveContact() {
    if (!state.branchId) { setStep(3); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/v1/merchant/branches/${state.branchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: branchAddress || undefined, phone: branchPhone || undefined }),
      });
      if (!res.ok) throw new Error();
      setStep(3);
    } catch { setErr("שמירה נכשלה, נסה שנית"); }
    finally { setBusy(false); }
  }

  async function saveOrderSettings() {
    if (!state.branchId) { setStep(4); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/v1/merchant/branches/${state.branchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ min_order: minOrder, delivery_fee: deliveryFee }),
      });
      if (!res.ok) throw new Error();
      setStep(4);
    } catch { setErr("שמירה נכשלה, נסה שנית"); }
    finally { setBusy(false); }
  }

  async function savePaymentsAndHours() {
    setBusy(true); setErr(null);
    try {
      const tasks: Promise<Response>[] = [
        fetch("/api/v1/merchant/payments", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accepts_cash: acceptsCash,
            grow: { is_active: growActive, test_mode: false, user_id: growUserId || undefined, max_installments: 1 },
          }),
        }),
      ];
      if (state.branchId) {
        tasks.push(fetch(`/api/v1/merchant/branches/${state.branchId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hours: wizardHours }),
        }));
      }
      const results = await Promise.all(tasks);
      if (!results.every((r) => r.ok)) throw new Error();
      setStep(5);
    } catch { setErr("שמירה נכשלה, נסה שנית"); }
    finally { setBusy(false); }
  }

  async function createCategory() {
    if (!categoryName.trim()) { setErr("הזן שם קטגוריה"); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/v1/merchant/menu/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim() }),
      });
      if (!res.ok) throw new Error();
      onClose();
      router.push("/dashboard/menu/new");
    } catch { setErr("יצירה נכשלה, נסה שנית"); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} size="xl" ariaLabel="אשף הקמת חנות" closeOnBackdrop={false}>
      <div className="flex flex-col h-full" dir="rtl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-black bg-[#F8CB1E] rounded-t-3xl shrink-0">
          <div className="w-9 h-9 rounded-xl bg-black grid place-items-center shrink-0">
            <IcoMenuBook c="#F8CB1E" s={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-sm text-black">הקמת החנות</div>
            <div className="text-[11px] text-black/60">שלב {step} מתוך 5</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 grid place-items-center transition"
            aria-label="סגור"
          >
            <IcoClose c="#000" s={14} />
          </button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b border-black/10 shrink-0">
          {WIZARD_STEPS.map(({ n, label }) => (
            <div
              key={n}
              className={cn(
                "flex-1 py-3 text-center text-[11px] font-bold transition flex flex-col items-center gap-1",
                step === n
                  ? "bg-black text-[#F8CB1E]"
                  : step > n
                    ? "text-black/50 bg-black/[0.04]"
                    : "text-black/30",
              )}
            >
              {step > n ? (
                <span className="w-4 h-4 rounded-full bg-black grid place-items-center">
                  <IcoCheck c="#F8CB1E" s={9} />
                </span>
              ) : (
                <span className={cn(
                  "w-4 h-4 rounded-full grid place-items-center text-[9px] font-black",
                  step === n ? "bg-[#F8CB1E] text-black" : "bg-black/10 text-black/40",
                )}>{n}</span>
              )}
              <span className="hidden sm:block">{label}</span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {step === 1 && (
            <div className="space-y-4">
              <WizardSectionHeader
                icon={<IcoGear c="#000" s={18} />}
                title="זהות החנות"
                sub="השם והסגנון שיוצגו ללקוחות בדף ההזמנות"
              />
              <WizardField label="שם החנות (פומבי)">
                <input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="לדוגמה: פיצה מריה"
                  autoFocus
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-black outline-none text-base font-bold placeholder:font-normal placeholder:text-black/30"
                />
              </WizardField>
              <WizardField label="סוג מטבח" optional>
                <input
                  value={cuisineType}
                  onChange={(e) => setCuisineType(e.target.value)}
                  placeholder="לדוגמה: פיצה נפוליטנית, בורגר אמריקאי"
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-black outline-none text-base placeholder:text-black/30"
                />
              </WizardField>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <WizardSectionHeader
                icon={<IcoGear c="#000" s={18} />}
                title="פרטי הסניף"
                sub="הכתובת והטלפון שיוצגו ללקוחות ובחשבוניות"
              />
              <WizardField label="כתובת מלאה" optional>
                <input
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder="לדוגמה: רחוב הרצל 12, תל אביב"
                  autoFocus
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-black outline-none text-base placeholder:text-black/30"
                />
              </WizardField>
              <WizardField label="טלפון" optional>
                <input
                  value={branchPhone}
                  onChange={(e) => setBranchPhone(e.target.value)}
                  placeholder="050-0000000"
                  dir="ltr"
                  type="tel"
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-black outline-none text-base placeholder:text-black/30"
                />
              </WizardField>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <WizardSectionHeader
                icon={<IcoMenuList c="#000" s={18} />}
                title="הגדרות הזמנה"
                sub="סכום מינימום ודמי משלוח שיוצגו בדף הלקוח"
              />
              <div className="grid grid-cols-2 gap-3">
                <WizardField label="סכום הזמנה מינימלי">
                  <div className="flex items-center border-2 border-black rounded-xl overflow-hidden">
                    <span className="px-3 py-3 text-black/50 text-sm select-none border-s-2 border-black">₪</span>
                    <input
                      type="number"
                      min={0}
                      value={minOrder}
                      onChange={(e) => setMinOrder(parseInt(e.target.value, 10) || 0)}
                      className="flex-1 px-3 py-3 outline-none bg-transparent tnum text-base font-bold"
                    />
                  </div>
                </WizardField>
                <WizardField label="דמי משלוח ברירת מחדל">
                  <div className="flex items-center border-2 border-black rounded-xl overflow-hidden">
                    <span className="px-3 py-3 text-black/50 text-sm select-none border-s-2 border-black">₪</span>
                    <input
                      type="number"
                      min={0}
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(parseInt(e.target.value, 10) || 0)}
                      className="flex-1 px-3 py-3 outline-none bg-transparent tnum text-base font-bold"
                    />
                  </div>
                </WizardField>
              </div>
              <p className="text-xs text-black/50">
                ניתן להוסיף אזורי משלוח עם תעריפים שונים בהגדרות לאחר מכן.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <WizardSectionHeader
                icon={<IcoCreditCard c="#000" s={18} />}
                title="תשלומים ושעות פתיחה"
                sub="הגדירו איך הלקוחות ישלמו ומתי החנות פעילה"
              />

              {/* Payment methods */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-black">אמצעי תשלום</label>
                <div
                  role="checkbox"
                  aria-checked={acceptsCash}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === " " && setAcceptsCash((v) => !v)}
                  onClick={() => setAcceptsCash((v) => !v)}
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition select-none",
                    acceptsCash ? "border-black bg-black/5" : "border-black/20 bg-white",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">מזומן</div>
                    <div className="text-xs text-black/55">תשלום לשליח בעת המסירה</div>
                  </div>
                  <WizardCheckbox checked={acceptsCash} />
                </div>

                <div className={cn(
                  "p-3.5 rounded-xl border-2 cursor-pointer transition",
                  growActive ? "border-black bg-black/5" : "border-black/20 bg-white",
                )}>
                  <div
                    role="checkbox"
                    aria-checked={growActive}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === " " && setGrowActive((v) => !v)}
                    onClick={() => setGrowActive((v) => !v)}
                    className="flex items-center gap-3 select-none"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">Grow Payments</div>
                      <div className="text-xs text-black/55">אשראי, Bit, Apple Pay, Google Pay, PayBox</div>
                    </div>
                    <WizardCheckbox checked={growActive} />
                  </div>
                  {growActive && (
                    <div className="mt-3 pt-3 border-t border-black/10" onClick={(e) => e.stopPropagation()}>
                      <WizardField label="User ID של Grow (Production)">
                        <input
                          value={growUserId}
                          onChange={(e) => setGrowUserId(e.target.value.trim())}
                          placeholder="f31a894ee5522c02"
                          dir="ltr"
                          autoComplete="off"
                          spellCheck={false}
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black outline-none font-mono text-sm placeholder:font-sans placeholder:text-black/30"
                        />
                      </WizardField>
                      <p className="text-[11px] text-black/45 mt-1.5">
                        השאר ריק לבדיקות (Sandbox). מגיע ממייל אישור החיוב לייב של Grow.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Hours */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-black">שעות פתיחה</label>
                <div className="rounded-xl border-2 border-black/15 divide-y divide-black/10 overflow-hidden">
                  {WIZARD_DAYS.map((d) => {
                    const h = wizardHours[d.key];
                    return (
                      <div key={d.key} className="flex items-center gap-2 px-3 py-2">
                        <span className="text-xs font-medium w-14 shrink-0">{d.label}</span>
                        <button
                          type="button"
                          onClick={() => setWizardHours((prev) => ({ ...prev, [d.key]: { ...prev[d.key], active: !h.active } }))}
                          className={cn(
                            "text-[10px] font-bold px-2.5 py-1 rounded-lg border shrink-0 transition",
                            h.active ? "bg-black text-white border-black" : "bg-white text-black/40 border-black/25",
                          )}
                        >
                          {h.active ? "פתוח" : "סגור"}
                        </button>
                        {h.active && (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="time"
                              value={h.open}
                              onChange={(e) => setWizardHours((prev) => ({ ...prev, [d.key]: { ...prev[d.key], open: e.target.value } }))}
                              dir="ltr"
                              className="flex-1 min-w-0 text-xs border border-black/20 rounded-lg px-2 py-1 outline-none"
                            />
                            <span className="text-xs text-black/35">—</span>
                            <input
                              type="time"
                              value={h.close}
                              onChange={(e) => setWizardHours((prev) => ({ ...prev, [d.key]: { ...prev[d.key], close: e.target.value } }))}
                              dir="ltr"
                              className="flex-1 min-w-0 text-xs border border-black/20 rounded-lg px-2 py-1 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-black/40">
                ניתן לשנות הגדרות אלו בכל עת בהגדרות החנות.
              </p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <WizardSectionHeader
                icon={<IcoMenuBook c="#000" s={18} />}
                title="צרו קטגוריה ראשונה"
                sub="קטגוריות מסדרות את התפריט — פיצות, תוספות, שתייה..."
              />
              <WizardField label="שם הקטגוריה">
                <input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !busy && createCategory()}
                  placeholder="לדוגמה: פיצות"
                  autoFocus
                  className="w-full px-3.5 py-3 rounded-xl border-2 border-black outline-none text-base font-bold placeholder:font-normal placeholder:text-black/30"
                />
              </WizardField>
              <p className="text-xs text-black/50">
                לאחר יצירת הקטגוריה תועברו מיד להוסיף את המוצר הראשון.
              </p>
            </div>
          )}

          {err && (
            <div className="rounded-xl bg-qf-tomato/5 border border-qf-tomato/30 px-3.5 py-2.5 text-sm text-qf-tomato">
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-5 border-t-2 border-black/10 bg-white rounded-b-3xl">
          {step > 1 && (
            <button
              type="button"
              onClick={prev}
              className="px-4 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold text-sm hover:bg-black/5 transition"
            >
              חזרה
            </button>
          )}
          <div className="flex-1" />
          {step < 5 && (
            <button
              type="button"
              disabled={busy}
              onClick={
                step === 1 ? saveIdentity
                : step === 2 ? saveContact
                : step === 3 ? saveOrderSettings
                : savePaymentsAndHours
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#F8CB1E] font-black text-sm border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-none transition disabled:opacity-60"
            >
              {busy ? "שומר..." : step === 4 ? "המשך לתפריט" : "שמור והמשך"}
              <IcoArrowLeft c="currentColor" s={14} />
            </button>
          )}
          {step === 5 && (
            <button
              type="button"
              disabled={busy || !categoryName.trim()}
              onClick={createCategory}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#F8CB1E] font-black text-sm border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-none transition disabled:opacity-60"
            >
              {busy ? "יוצר..." : "צור קטגוריה והמשך"}
              <IcoArrowLeft c="currentColor" s={14} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function WizardSectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3 pb-1">
      <div className="w-10 h-10 rounded-xl bg-[#F8CB1E] border-2 border-black grid place-items-center shrink-0 shadow-[0_2px_0_#000]">
        {icon}
      </div>
      <div>
        <div className="font-black text-base text-black">{title}</div>
        <div className="text-xs text-black/55 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function WizardField({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-bold text-black">{label}</label>
        {optional && <span className="text-[10px] text-black/40 border border-black/20 rounded px-1">אופציונלי</span>}
      </div>
      {children}
    </div>
  );
}

function WizardCheckbox({ checked }: { checked: boolean }) {
  return (
    <div className={cn(
      "w-5 h-5 rounded-md border-2 shrink-0 grid place-items-center transition",
      checked ? "bg-black border-black" : "bg-white border-black/25",
    )}>
      {checked && <IcoCheck c="#F8CB1E" s={10} />}
    </div>
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
