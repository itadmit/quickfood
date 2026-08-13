export interface DayHours {
  open: string;
  close: string;
  active: boolean;
}

export type BranchHours = Partial<Record<DayKey, DayHours>>;

export type DayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

const DAY_KEYS: DayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DAY_LABEL: Record<DayKey, string> = {
  sunday: "יום ראשון",
  monday: "יום שני",
  tuesday: "יום שלישי",
  wednesday: "יום רביעי",
  thursday: "יום חמישי",
  friday: "יום שישי",
  saturday: "שבת",
};

// Opening hours are the merchant's wall clock, so every comparison has to
// happen in Israel time - NOT the runtime's. Vercel functions run in UTC, and
// the customer's phone can be set to anything, so `Date.getHours()` was giving
// two different answers for the same order. Mirrors the TZ pin in lib/format.ts.
const TZ = "Asia/Jerusalem";

const MINUTES_PER_DAY = 24 * 60;

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  /** 0 = Sunday, matching DAY_KEYS. */
  weekday: number;
  /** Minutes from local midnight. */
  minutes: number;
}

function zonedParts(at: Date): ZonedParts {
  const parts = partsFmt.formatToParts(at);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // hourCycle h23 still reports "24" for midnight in some engines.
  const hour = Number(pick("hour")) % 24;
  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    weekday: WEEKDAY_INDEX[pick("weekday")] ?? 0,
    minutes: hour * 60 + Number(pick("minute")),
  };
}

function tzOffsetMs(at: Date): number {
  const p = zonedParts(at);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, 0, p.minutes);
  return asUtc - Math.floor(at.getTime() / 60_000) * 60_000;
}

/**
 * The instant at which the Israel wall clock reads the given calendar date
 * plus `minutes` from midnight. `minutes` may exceed 1440 - Date.UTC rolls the
 * day over, which is what makes an overnight window (close 02:00 => 1560) a
 * single continuous range. Two passes so a slot on the far side of a DST change
 * resolves against its own offset rather than the guess's.
 */
function zonedInstant(year: number, month: number, day: number, minutes: number): Date {
  const naive = Date.UTC(year, month - 1, day, 0, minutes);
  let ts = naive - tzOffsetMs(new Date(naive));
  ts = naive - tzOffsetMs(new Date(ts));
  return new Date(ts);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

/**
 * A day's window as minutes from ITS OWN midnight. `close <= open` means the
 * window runs past midnight (20:00-02:00 => 1200..1560), and open === close is
 * read as round-the-clock rather than a zero-length day.
 */
function windowOf(day: DayHours | undefined): { open: number; end: number } | null {
  if (!day?.active) return null;
  const o = toMinutes(day.open);
  const c = toMinutes(day.close);
  if (o === null || c === null) return null;
  const end = c <= o ? c + MINUTES_PER_DAY : c;
  return end > o ? { open: o, end } : null;
}

export interface OpenStatus {
  /** True when `now` falls inside an active window. */
  open: boolean;
  /** "HH:MM" the current window closes at - only set when open=true. */
  closesAt: string | null;
  /** Next open day label + "HH:MM" the next window starts - only set when open=false. */
  nextOpen: { dayLabel: string; time: string } | null;
}

/**
 * True when `when` falls inside an active open window (handles overnight
 * windows that spill from the previous day). Authoritative check used to
 * reject scheduled orders placed outside the branch's opening hours.
 */
export function isWithinOpenHours(hours: BranchHours, when: Date): boolean {
  const { weekday, minutes } = zonedParts(when);

  const today = windowOf(hours[DAY_KEYS[weekday]]);
  if (today && minutes >= today.open && minutes < today.end) return true;

  const yesterday = windowOf(hours[DAY_KEYS[(weekday + 6) % 7]]);
  if (yesterday && yesterday.end > MINUTES_PER_DAY) {
    if (minutes < yesterday.end - MINUTES_PER_DAY) return true;
  }

  return false;
}

export function getOpenStatus(hours: BranchHours, now = new Date()): OpenStatus {
  const { weekday, minutes } = zonedParts(now);

  const todayKey = DAY_KEYS[weekday];
  const today = windowOf(hours[todayKey]);
  if (today && minutes >= today.open && minutes < today.end) {
    return { open: true, closesAt: hours[todayKey]!.close, nextOpen: null };
  }

  const yesterdayKey = DAY_KEYS[(weekday + 6) % 7];
  const yesterday = windowOf(hours[yesterdayKey]);
  if (yesterday && yesterday.end > MINUTES_PER_DAY && minutes < yesterday.end - MINUTES_PER_DAY) {
    return { open: true, closesAt: hours[yesterdayKey]!.close, nextOpen: null };
  }

  for (let i = 0; i < 7; i++) {
    const idx = (weekday + i) % 7;
    const key = DAY_KEYS[idx];
    const day = hours[key];
    const win = windowOf(day);
    if (!win) continue;
    if (i === 0 && win.open <= minutes) continue;
    return {
      open: false,
      closesAt: null,
      nextOpen: {
        dayLabel: i === 0 ? "היום" : i === 1 ? "מחר" : DAY_LABEL[key],
        time: day!.open,
      },
    };
  }

  return { open: false, closesAt: null, nextOpen: null };
}

export interface ScheduleSlot {
  /** Absolute instant - hand this to the server, never a bare "HH:MM". */
  iso: string;
  /** "HH:MM" in Israel time, for the button label. */
  time: string;
  /** "YYYY-MM-DD" in Israel time, for grouping slots into day tabs. */
  dayKey: string;
  /** "היום" / "מחר" / "יום שלישי · 18.08". */
  dayLabel: string;
}

export interface ScheduleSlotOptions {
  now?: Date;
  /** Kitchen lead time before the earliest bookable slot. */
  leadMinutes?: number;
  stepMinutes?: number;
  /** How many days ahead to offer, Wolt-style. 0 = today only. */
  horizonDays?: number;
}

const DEFAULT_LEAD_MINUTES = 30;
const DEFAULT_STEP_MINUTES = 15;
const DEFAULT_HORIZON_DAYS = 7;
// Guard against a pathological config (24/7 + a long horizon) producing a
// dropdown with thousands of entries.
const MAX_SLOTS = 600;

/**
 * Every bookable slot from now to `horizonDays` ahead, as absolute instants.
 *
 * Slots are built from the branch's open windows expanded onto real calendar
 * days, which is what makes a 20:00-02:00 restaurant work: its window is one
 * continuous range crossing midnight, so 00:30 is offered as tomorrow's date
 * rather than being clipped at 23:59 (or vanishing entirely once the clock
 * passes midnight and "today" is a closed day).
 */
export function getScheduleSlots(
  hours: BranchHours,
  opts: ScheduleSlotOptions = {},
): ScheduleSlot[] {
  const now = opts.now ?? new Date();
  const lead = opts.leadMinutes ?? DEFAULT_LEAD_MINUTES;
  const step = Math.max(1, opts.stepMinutes ?? DEFAULT_STEP_MINUTES);
  const horizonDays = Math.max(0, opts.horizonDays ?? DEFAULT_HORIZON_DAYS);

  const today = zonedParts(now);

  // Start at -1 so a window opened before midnight is still live after it.
  const intervals: Array<{ start: number; end: number }> = [];
  for (let offset = -1; offset <= horizonDays; offset++) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const win = windowOf(hours[DAY_KEYS[date.getUTCDay()]]);
    if (!win) continue;
    const y = date.getUTCFullYear();
    const mo = date.getUTCMonth() + 1;
    const d = date.getUTCDate();
    intervals.push({
      start: zonedInstant(y, mo, d, win.open).getTime(),
      end: zonedInstant(y, mo, d, win.end).getTime(),
    });
  }

  // Merge so a window that runs into the next day's own window (or a 24/7
  // branch) doesn't emit the same slot twice.
  intervals.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  }

  const earliest = alignUp(new Date(now.getTime() + lead * 60_000), step);
  const horizonEnd = zonedInstant(today.year, today.month, today.day + horizonDays + 1, 0).getTime();

  const out: ScheduleSlot[] = [];
  const stepMs = step * 60_000;
  for (const iv of merged) {
    if (iv.end <= earliest) continue;
    let t = iv.start >= earliest ? iv.start : alignUp(new Date(earliest), step);
    for (; t < iv.end && t < horizonEnd; t += stepMs) {
      if (out.length >= MAX_SLOTS) return out;
      out.push(makeSlot(new Date(t), today));
    }
  }
  return out;
}

function alignUp(at: Date, step: number): number {
  const p = zonedParts(at);
  const rem = p.minutes % step;
  const minutes = rem === 0 ? p.minutes : p.minutes + (step - rem);
  return zonedInstant(p.year, p.month, p.day, minutes).getTime();
}

function makeSlot(at: Date, today: ZonedParts): ScheduleSlot {
  const p = zonedParts(at);
  const dayUtc = Date.UTC(p.year, p.month - 1, p.day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const diff = Math.round((dayUtc - todayUtc) / 86_400_000);
  const weekday = new Date(dayUtc).getUTCDay();
  return {
    iso: at.toISOString(),
    time: `${pad(Math.floor(p.minutes / 60))}:${pad(p.minutes % 60)}`,
    dayKey: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    dayLabel:
      diff === 0
        ? "היום"
        : diff === 1
          ? "מחר"
          : `${DAY_LABEL[DAY_KEYS[weekday]]} · ${pad(p.day)}.${pad(p.month)}`,
  };
}
