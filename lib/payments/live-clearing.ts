/**
 * Does this provider row represent REAL card clearing for the merchant?
 *
 * Card payments are offered only when it does. A provider in test mode, or a
 * live provider without the merchant's own terminal credentials, means "no
 * clearing": the storefront, kiosk and pay pages show no card option at all
 * and every card initiation is refused.
 *
 * Why: Grow test mode swaps in a shared account instead of the merchant's
 * terminal, and that account takes real money (incident S-8, Smash Burger,
 * 2026-11-07: a customer paid 385 into it and the restaurant got nothing).
 *
 * Pure function - see tests/live-clearing.test.ts.
 */

export interface ClearingRow {
  provider: string;
  testMode: boolean;
  credentials: unknown;
}

const REQUIRED_CREDENTIALS: Record<string, readonly string[]> = {
  grow: ["userId"],
  cardcom: ["terminalNumber", "apiName", "apiPassword"],
  hyp: ["masof", "passP", "apiKey"],
};

export function hasLiveClearing(row: ClearingRow): boolean {
  if (row.testMode) return false;
  const required = REQUIRED_CREDENTIALS[row.provider];
  if (!required) return false;
  const creds = (row.credentials ?? {}) as Record<string, unknown>;
  return required.every((k) => typeof creds[k] === "string" && (creds[k] as string).trim() !== "");
}
