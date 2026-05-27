import type { ShortIdMap } from "./menu-snapshot";

export function stripMarkdown(text: string): string {
  let out = text.replace(/\*\*/g, "").replace(/(^|\s)\*(?=\S)/g, "$1• ").replace(/`/g, "");
  out = out.replace(/\s*\(x[0-9a-z]+\)/gi, "");
  out = out.replace(/\bx[0-9a-z]{1,4}\b(?=[\s,.;:!?־]|$)/gi, "");
  out = out.replace(/[ \t]{2,}/g, " ");
  return out;
}

export function translateToolArgs(
  args: Record<string, unknown>,
  idMap: ShortIdMap,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };
  const toReal = (v: unknown) =>
    typeof v === "string" ? (idMap.toReal[v] ?? v) : v;
  if (Array.isArray(out.item_ids)) out.item_ids = (out.item_ids as unknown[]).map(toReal);
  if (Array.isArray(out.option_ids)) out.option_ids = (out.option_ids as unknown[]).map(toReal);
  if ("item_id" in out) out.item_id = toReal(out.item_id);
  if ("size_id" in out) out.size_id = toReal(out.size_id);
  return out;
}

export function humanizeProviderError(err: unknown, providerLabel: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/\b429\b|quota|rate.?limit|Too Many Requests|overloaded/i.test(raw)) {
    return `המכסה החינמית של ${providerLabel} מוצתה. נסה שוב בעוד דקה, או שדרג את החשבון.`;
  }
  if (/\b40[13]\b|API key.*not valid|API_KEY_INVALID|authentication/i.test(raw)) {
    return `המפתח של ${providerLabel} לא תקין או חסר הרשאות.`;
  }
  if (/\b404\b|not found.*model/i.test(raw)) {
    return "מודל ה-AI אינו זמין כרגע. פנו לתמיכה.";
  }
  return raw || "שגיאה לא ידועה";
}
