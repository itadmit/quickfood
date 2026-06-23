export type LoyaltyTier = "silver" | "gold" | "platinum";

export const LOYALTY_TIERS: LoyaltyTier[] = ["silver", "gold", "platinum"];

export interface LoyaltyTierConfig {
  name: string;
  minPoints: number;
}

export interface LoyaltyJoinForm {
  title: string;
  subtitle: string;
  buttonText: string;
  imageUrl: string | null;
  collectName: boolean;
  collectEmail: boolean;
  collectBirthday: boolean;
  consentText: string;
}

export interface LoyaltyConfig {
  pointsPerShekel: number;
  tiers: Record<LoyaltyTier, LoyaltyTierConfig>;
  showJoinPopup: boolean;
  showCheckoutCheckbox: boolean;
  joinForm: LoyaltyJoinForm;
  checkoutConsentText: string;
}

export function defaultCheckoutConsentText(tenantName: string): string {
  return `הוסף/י אותי למועדון הלקוחות של ${tenantName} ואני מאשר/ת את מדיניות הפרטיות, תקנון האתר וקבלת תוכן שיווקי/פרסומי`;
}

export function defaultLoyaltyConfig(tenantName = "העסק"): LoyaltyConfig {
  return {
    pointsPerShekel: 1,
    tiers: {
      silver: { name: "סילבר", minPoints: 0 },
      gold: { name: "גולד", minPoints: 500 },
      platinum: { name: "פלטינה", minPoints: 2000 },
    },
    showJoinPopup: false,
    showCheckoutCheckbox: false,
    joinForm: {
      title: "מצטרפים למועדון הלקוחות",
      subtitle: "כל שקל שווה נקודה. צוברים, מתקדמים במסלולים ונהנים מהטבות.",
      buttonText: "הצטרפות למועדון",
      imageUrl: null,
      collectName: true,
      collectEmail: true,
      collectBirthday: false,
      consentText:
        "אני מאשר/ת את מדיניות הפרטיות, תקנון האתר וקבלת תוכן שיווקי/פרסומי",
    },
    checkoutConsentText: defaultCheckoutConsentText(tenantName),
  };
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length > 0 ? v : fallback;
}

function resolveTier(raw: unknown, fallback: LoyaltyTierConfig): LoyaltyTierConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    name: asString(r.name, fallback.name),
    minPoints: Math.max(0, Math.round(asNumber(r.minPoints, fallback.minPoints))),
  };
}

/**
 * Merge a tenant's stored loyalty_config JSON over the defaults so older
 * tenants (empty `{}`) and partially-saved configs always read back a fully
 * populated, typed object.
 */
export function resolveLoyaltyConfig(raw: unknown, tenantName = "העסק"): LoyaltyConfig {
  const d = defaultLoyaltyConfig(tenantName);
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const tiers = (r.tiers ?? {}) as Record<string, unknown>;
  const form = (r.joinForm ?? {}) as Record<string, unknown>;
  return {
    pointsPerShekel: Math.max(0, asNumber(r.pointsPerShekel, d.pointsPerShekel)),
    tiers: {
      silver: resolveTier(tiers.silver, d.tiers.silver),
      gold: resolveTier(tiers.gold, d.tiers.gold),
      platinum: resolveTier(tiers.platinum, d.tiers.platinum),
    },
    showJoinPopup: asBool(r.showJoinPopup, d.showJoinPopup),
    showCheckoutCheckbox: asBool(r.showCheckoutCheckbox, d.showCheckoutCheckbox),
    joinForm: {
      title: asString(form.title, d.joinForm.title),
      subtitle: asString(form.subtitle, d.joinForm.subtitle),
      buttonText: asString(form.buttonText, d.joinForm.buttonText),
      imageUrl: typeof form.imageUrl === "string" && form.imageUrl ? form.imageUrl : null,
      collectName: asBool(form.collectName, d.joinForm.collectName),
      collectEmail: asBool(form.collectEmail, d.joinForm.collectEmail),
      collectBirthday: asBool(form.collectBirthday, d.joinForm.collectBirthday),
      consentText: asString(form.consentText, d.joinForm.consentText),
    },
    checkoutConsentText: asString(r.checkoutConsentText, d.checkoutConsentText),
  };
}

/** Points earned for a given spend, in whole shekels. */
export function pointsForSpend(spendShekels: number, config: LoyaltyConfig): number {
  return Math.max(0, Math.round(spendShekels * config.pointsPerShekel));
}

/** Highest tier whose threshold the points clear. */
export function tierForPoints(points: number, config: LoyaltyConfig): LoyaltyTier {
  let tier: LoyaltyTier = "silver";
  for (const t of LOYALTY_TIERS) {
    if (points >= config.tiers[t].minPoints) tier = t;
  }
  return tier;
}

export function tierLabel(tier: LoyaltyTier, config: LoyaltyConfig): string {
  return config.tiers[tier].name;
}
