export interface GrowthSettings {
  // Assumed marketplace commission rate used for the "estimated commission
  // saved" calculation. Platform default 25%. Always presented as estimated.
  commissionRate: number;
  // Optional per-source overrides keyed by sourceKey (e.g. { wolt: 30 }).
  perSourceRates: Record<string, number>;
}

const DEFAULT_COMMISSION_RATE = 25;

/** Fills sane defaults over the tenant's growthSettings JSON blob. */
export function resolveGrowthSettings(raw: unknown): GrowthSettings {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rate = Number(obj.commissionRate);
  const perSourceRaw = (obj.perSourceRates && typeof obj.perSourceRates === "object"
    ? obj.perSourceRates
    : {}) as Record<string, unknown>;

  const perSourceRates: Record<string, number> = {};
  for (const [k, v] of Object.entries(perSourceRaw)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= 100) perSourceRates[k] = n;
  }

  return {
    commissionRate:
      Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : DEFAULT_COMMISSION_RATE,
    perSourceRates,
  };
}

/** Resolve the commission rate to apply for a given source key. */
export function commissionRateFor(settings: GrowthSettings, sourceKey: string): number {
  return settings.perSourceRates[sourceKey] ?? settings.commissionRate;
}
