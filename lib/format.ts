/**
 * Formatting helpers - Hebrew locale (he-IL), Israeli shekel.
 * Per QuickFood README: prices in integer shekels, phone in E.164 or local format.
 */

export function formatPrice(amount: number): string {
  return `₪${amount.toLocaleString("he-IL")}`;
}

/**
 * Compose a display "full name" from first/last parts.  Used everywhere
 * UI needs a one-line label (dashboard order rows, notifications,
 * payment provider snapshots).  Returns the empty string when both are
 * empty so callers can fall back to "אורח" cleanly.
 */
export function fullName(
  first?: string | null,
  last?: string | null,
): string {
  return [first ?? "", last ?? ""].map((s) => s.trim()).filter(Boolean).join(" ");
}

// Pin every display to Israel time. Vercel functions run in UTC by
// default, so an SSR-rendered date used to come out 2-3 hours off
// the wall clock the merchant sees. Hard-coding Asia/Jerusalem also
// covers customers whose phones are set to another TZ - the store's
// "scheduled for 19:00" stays the local 19:00 the merchant promised.
const TZ = "Asia/Jerusalem";

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  });
}

// Breaks a minute count into "D ימים H שעות M דקות", dropping zero parts and
// putting a "ו" before the last part only when there are 3 (days+hours+mins).
// e.g. 81 -> "שעה 21 דקות", 1583 -> "יום שעה ו23 דקות".
export function formatElapsedMinutes(totalMins: number): string {
  if (totalMins <= 0) return "עכשיו";
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;

  const parts: string[] = [];
  if (days) parts.push(days === 1 ? "יום" : `${days} ימים`);
  if (hours) parts.push(hours === 1 ? "שעה" : `${hours} שעות`);
  if (mins) parts.push(mins === 1 ? "דקה" : `${mins} דקות`);
  if (!parts.length) return "עכשיו";

  if (parts.length >= 3) {
    return `${parts.slice(0, -1).join(" ")} ו${parts[parts.length - 1]}`;
  }
  return parts.join(" ");
}

export function formatRelativeMinutes(from: Date | string): string {
  const d = typeof from === "string" ? new Date(from) : from;
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60_000));
  if (mins === 0) return "עכשיו";
  return `לפני ${formatElapsedMinutes(mins)}`;
}

/**
 * Phone: accepts +9725..., 9725..., 05..., 5...
 * Returns canonical E.164 (+972XXXXXXXXX) or null if invalid.
 */
export function toE164(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  let normalized: string;
  if (digits.startsWith("+972")) normalized = digits;
  else if (digits.startsWith("972")) normalized = "+" + digits;
  else if (digits.startsWith("0")) normalized = "+972" + digits.slice(1);
  else if (/^5\d{8}$/.test(digits)) normalized = "+972" + digits;
  else return null;

  if (!/^\+972\d{8,9}$/.test(normalized)) return null;
  return normalized;
}

export function formatPhone(e164: string): string {
  // +972501234567 ← 050-1234567
  const m = e164.match(/^\+972(\d{1,2})(\d{7})$/);
  if (!m) return e164;
  return `0${m[1]}-${m[2]}`;
}

export function formatOrderNumber(num: string): string {
  return `#${num}`;
}

/**
 * Generate a human-friendly order number: VR-7421 style.
 * Prefix is derived from the tenant slug.
 */
export function generateOrderNumber(tenantSlug: string): string {
  const prefix = tenantSlug
    .split("-")
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 3) || "QF";
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}
