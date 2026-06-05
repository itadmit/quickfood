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

function toMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  return h * 60 + min;
}

export interface OpenStatus {
  /** True when `now` falls inside an active window. */
  open: boolean;
  /** "HH:MM" the current window closes at - only set when open=true. */
  closesAt: string | null;
  /** Next open day label + "HH:MM" the next window starts - only set when open=false. */
  nextOpen: { dayLabel: string; time: string } | null;
}

export function getOpenStatus(hours: BranchHours, now = new Date()): OpenStatus {
  const todayIdx = now.getDay();
  const todayKey = DAY_KEYS[todayIdx];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const today = hours[todayKey];
  if (today?.active) {
    const o = toMinutes(today.open);
    const c = toMinutes(today.close);
    if (o !== null && c !== null) {
      const closesNextDay = c <= o;
      const closeWindow = closesNextDay ? c + 24 * 60 : c;
      if (nowMin >= o && nowMin < closeWindow) {
        return { open: true, closesAt: today.close, nextOpen: null };
      }
    }
  }

  const yesterdayIdx = (todayIdx + 6) % 7;
  const yesterday = hours[DAY_KEYS[yesterdayIdx]];
  if (yesterday?.active) {
    const o = toMinutes(yesterday.open);
    const c = toMinutes(yesterday.close);
    if (o !== null && c !== null && c <= o) {
      if (nowMin < c) {
        return { open: true, closesAt: yesterday.close, nextOpen: null };
      }
    }
  }

  for (let i = 0; i < 7; i++) {
    const idx = (todayIdx + i) % 7;
    const key = DAY_KEYS[idx];
    const day = hours[key];
    if (!day?.active) continue;
    const o = toMinutes(day.open);
    if (o === null) continue;
    if (i === 0 && o <= nowMin) continue;
    return {
      open: false,
      closesAt: null,
      nextOpen: { dayLabel: i === 0 ? "היום" : i === 1 ? "מחר" : DAY_LABEL[key], time: day.open },
    };
  }

  return { open: false, closesAt: null, nextOpen: null };
}
