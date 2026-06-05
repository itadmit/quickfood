/**
 * Compose a Wolt-style display string for a cart-line option.
 *
 *   "תרצו אקסטרה גבינה?"  +  "כן"        →  "תרצו אקסטרה גבינה?: כן"
 *   "בחרו תוספות לפיצה"   +  "זיתים"      →  "בחרו תוספות לפיצה: זיתים"
 *   ""                     +  "אקסטרה"    →  "אקסטרה"
 *
 * Verbatim - we keep the merchant's exact phrasing on both sides. Older
 * cart lines that were stored before we started capturing the group
 * name pass `undefined` for `groupName`; in that case we just show the
 * option name as-is.
 */
export function formatOptionDisplayName(
  groupName: string | null | undefined,
  optionName: string,
): string {
  const o = optionName.trim();
  const g = (groupName ?? "").trim();
  if (!g || g === o) return o;
  return `${g}: ${o}`;
}
