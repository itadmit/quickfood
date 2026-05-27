/**
 * Combine an option-group name with the picked option name into a
 * cart-friendly display string.
 *
 * Generic affirmative/negative options ("כן" / "לא" / "yes" / "no")
 * carry no information by themselves — "מרגריטה · כן" tells the customer
 * nothing about what they ordered. We swap in the group name so the
 * cart row reads "מרגריטה · אקסטרה גבינה" / "ללא אקסטרה גבינה".
 *
 * For descriptive option names ("זיתים", "בצל", "מוצרלה") we keep the
 * option name as-is — the group name would be redundant ("תוספות: זיתים").
 */
const YES_TOKENS = new Set(["כן", "yes", "true", "v", "✓"]);
const NO_TOKENS = new Set(["לא", "no", "false", "x", "✕"]);

export function formatOptionDisplayName(
  groupName: string | null | undefined,
  optionName: string,
): string {
  const o = optionName.trim();
  const g = (groupName ?? "").trim();
  if (!g || g === o) return o;
  const lower = o.toLowerCase();
  if (YES_TOKENS.has(lower)) return g;
  if (NO_TOKENS.has(lower)) return `ללא ${g}`;
  return o;
}
