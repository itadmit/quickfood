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

export interface LoyaltyRedemptionConfig {
  // Master switch: "אפשר תשלום בנקודות" in the club settings.
  enabled: boolean;
  // Worth of one point at checkout, in agorot (5 = ₪0.05). Config-only
  // number - order money stays whole shekels.
  pointValueAgorot: number;
  // Points may cover at most this share of the order's items subtotal.
  maxPercentOfOrder: number;
  // Below this balance the redemption toggle doesn't show.
  minPoints: number;
}

export interface LoyaltyConfig {
  // Legacy single earn rate - kept as the fallback each tier defaults to,
  // so configs saved before per-tier rates keep their exact behaviour.
  pointsPerShekel: number;
  // Per-tier earn rate: points per ₪1 while the member holds that tier.
  earnPerShekel: Record<LoyaltyTier, number>;
  redemption: LoyaltyRedemptionConfig;
  tiers: Record<LoyaltyTier, LoyaltyTierConfig>;
  showJoinPopup: boolean;
  // true → the entry popup shows only once per visitor (until they dismiss or
  // join). false → it shows on every visit.
  popupShowOnce: boolean;
  showCheckoutCheckbox: boolean;
  joinForm: LoyaltyJoinForm;
  checkoutConsentText: string;
  // Birthday benefit: when on, a unique percent-off coupon is auto-issued to
  // each member on their birthday (see lib/loyalty/birthday). The greeting is
  // the message body sent over WhatsApp/SMS - supports {name} {business}
  // {coupon} {expiry} tokens.
  birthdayBenefit: boolean;
  birthdayDiscountPercent: number;
  birthdayGreeting: string;
}

/** Gender-neutral default birthday greeting. Tokens: {name} {business} {coupon} {expiry}. */
export function defaultBirthdayGreeting(): string {
  return [
    "היום יום הולדת! היום יום הולדת! היום יום הולדת ל-{name}!",
    "אנחנו ב-{business} לא שכחנו את יום ההולדת שלך, ואנחנו מאחלים המון מזל טוב!",
    "החלטנו להעניק לך הנחה לכבוד חודש יום ההולדת, תקפה עד {expiry}.",
    "כל מה שנותר זה להזמין ולהזין את קוד הקופון: {coupon}",
    "",
    "אוהבים,",
    "{business}",
  ].join("\n");
}

/** Fill the {name}/{business}/{coupon}/{expiry} tokens of a greeting template. */
export function renderBirthdayGreeting(
  template: string,
  vars: { name: string; business: string; coupon: string; expiry: string },
): string {
  return template
    .replaceAll("{name}", vars.name || "חבר/ה")
    .replaceAll("{business}", vars.business)
    .replaceAll("{coupon}", vars.coupon)
    .replaceAll("{expiry}", vars.expiry);
}

export function defaultCheckoutConsentText(tenantName: string): string {
  return `הוסף/י אותי למועדון הלקוחות של ${tenantName} ואני מאשר/ת את מדיניות הפרטיות, תקנון האתר וקבלת תוכן שיווקי/פרסומי`;
}

export function defaultLoyaltyConfig(tenantName = "העסק"): LoyaltyConfig {
  return {
    pointsPerShekel: 1,
    earnPerShekel: { silver: 1, gold: 1, platinum: 1 },
    redemption: { enabled: false, pointValueAgorot: 5, maxPercentOfOrder: 50, minPoints: 20 },
    tiers: {
      silver: { name: "סילבר", minPoints: 0 },
      gold: { name: "גולד", minPoints: 500 },
      platinum: { name: "פלטינה", minPoints: 2000 },
    },
    showJoinPopup: false,
    popupShowOnce: true,
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
    birthdayBenefit: false,
    birthdayDiscountPercent: 15,
    birthdayGreeting: defaultBirthdayGreeting(),
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
  const earn = (r.earnPerShekel ?? {}) as Record<string, unknown>;
  const redemption = (r.redemption ?? {}) as Record<string, unknown>;
  const legacyRate = Math.max(0, asNumber(r.pointsPerShekel, d.pointsPerShekel));
  return {
    pointsPerShekel: legacyRate,
    earnPerShekel: {
      silver: Math.max(0, asNumber(earn.silver, legacyRate)),
      gold: Math.max(0, asNumber(earn.gold, legacyRate)),
      platinum: Math.max(0, asNumber(earn.platinum, legacyRate)),
    },
    redemption: {
      enabled: asBool(redemption.enabled, d.redemption.enabled),
      pointValueAgorot: Math.max(
        1,
        Math.round(asNumber(redemption.pointValueAgorot, d.redemption.pointValueAgorot)),
      ),
      maxPercentOfOrder: Math.min(
        100,
        Math.max(1, Math.round(asNumber(redemption.maxPercentOfOrder, d.redemption.maxPercentOfOrder))),
      ),
      minPoints: Math.max(0, Math.round(asNumber(redemption.minPoints, d.redemption.minPoints))),
    },
    tiers: {
      silver: resolveTier(tiers.silver, d.tiers.silver),
      gold: resolveTier(tiers.gold, d.tiers.gold),
      platinum: resolveTier(tiers.platinum, d.tiers.platinum),
    },
    showJoinPopup: asBool(r.showJoinPopup, d.showJoinPopup),
    popupShowOnce: asBool(r.popupShowOnce, d.popupShowOnce),
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
    birthdayBenefit: asBool(r.birthdayBenefit, d.birthdayBenefit),
    birthdayDiscountPercent: Math.min(
      100,
      Math.max(1, Math.round(asNumber(r.birthdayDiscountPercent, d.birthdayDiscountPercent))),
    ),
    birthdayGreeting: asString(r.birthdayGreeting, d.birthdayGreeting),
  };
}

/** Points earned for a given spend, in whole shekels. */
export function pointsForSpend(spendShekels: number, config: LoyaltyConfig): number {
  return Math.max(0, Math.round(spendShekels * config.pointsPerShekel));
}

/** Per-tier earn rate (points per ₪1). */
export function earnRateForTier(config: LoyaltyConfig, tier: LoyaltyTier): number {
  return config.earnPerShekel[tier] ?? config.pointsPerShekel;
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
