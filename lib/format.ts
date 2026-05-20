/**
 * Formatting helpers — Hebrew locale (he-IL), Israeli shekel.
 * Per QuickFood README: prices in integer shekels, phone in E.164 or local format.
 */

export function formatPrice(amount: number): string {
  return `₪${amount.toLocaleString("he-IL")}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
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
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatRelativeMinutes(from: Date | string): string {
  const d = typeof from === "string" ? new Date(from) : from;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60_000));
  if (mins === 0) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק'`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
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
