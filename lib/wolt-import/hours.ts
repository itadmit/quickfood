import type { WoltScheduleEntry } from "./types";

export type DayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export interface DayHours {
  open: string;
  close: string;
  active: boolean;
}

export type HoursMap = Record<DayKey, DayHours>;

const DEFAULT_OPEN = "11:00";
const DEFAULT_CLOSE = "23:00";

const DAYS_ORDER: DayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const HE_DAY_TO_KEY: Record<string, DayKey> = {
  "יום ראשון": "sunday",
  ראשון: "sunday",
  "יום שני": "monday",
  שני: "monday",
  "יום שלישי": "tuesday",
  שלישי: "tuesday",
  "יום רביעי": "wednesday",
  רביעי: "wednesday",
  "יום חמישי": "thursday",
  חמישי: "thursday",
  "יום שישי": "friday",
  שישי: "friday",
  "יום שבת": "saturday",
  שבת: "saturday",
};

const TIME_RANGE = /^\s*(\d{1,2}):(\d{2})\s*[–—‐\-]\s*(\d{1,2}):(\d{2})\s*$/;

function parseTimeRange(formatted: string): { open: string; close: string } | null {
  const m = formatted.match(TIME_RANGE);
  if (!m) return null;
  const [, oh, om, ch, cm] = m;
  const ohh = Number(oh);
  const chh = Number(ch);
  const omm = Number(om);
  const cmm = Number(cm);
  if (ohh > 23 || chh > 24 || omm > 59 || cmm > 59) return null;
  return {
    open: `${ohh.toString().padStart(2, "0")}:${om}`,
    close: `${chh.toString().padStart(2, "0")}:${cm}`,
  };
}

export function woltScheduleToHours(
  schedule: WoltScheduleEntry[] | null | undefined,
): HoursMap {
  const map = {} as HoursMap;
  for (const key of DAYS_ORDER) {
    map[key] = { open: DEFAULT_OPEN, close: DEFAULT_CLOSE, active: false };
  }
  if (!Array.isArray(schedule)) return map;
  for (const entry of schedule) {
    const key = HE_DAY_TO_KEY[entry.day?.trim() ?? ""];
    if (!key) continue;
    const parsed = parseTimeRange(entry.formatted_times ?? "");
    if (parsed) map[key] = { ...parsed, active: true };
  }
  return map;
}

const HE_LABELS: Record<DayKey, string> = {
  sunday: "ראשון",
  monday: "שני",
  tuesday: "שלישי",
  wednesday: "רביעי",
  thursday: "חמישי",
  friday: "שישי",
  saturday: "שבת",
};

export function hoursPreviewSummary(
  hours: HoursMap,
): Array<{ day: DayKey; label: string; display: string; active: boolean }> {
  return DAYS_ORDER.map((d) => ({
    day: d,
    label: HE_LABELS[d],
    display: hours[d].active ? `${hours[d].open}–${hours[d].close}` : "סגור",
    active: hours[d].active,
  }));
}
