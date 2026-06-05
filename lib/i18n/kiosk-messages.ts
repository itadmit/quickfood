/**
 * Kiosk string defaults + the t() builder.
 *
 * Architecture in three layers:
 *
 *   1. Defaults (this file) - every user-facing string in the kiosk,
 *      keyed by a dotted path ("payQr.steps.scan"). Hebrew today; an
 *      `en.ts` / `ar.ts` neighbour can be added later without touching
 *      callers.
 *
 *   2. Tenant overrides - flat dotted-key JSON on `Tenant.kioskStringOverrides`.
 *      A single missing key falls through to the default; a fully empty
 *      object (the default) means "everything stock".
 *
 *   3. Interpolation - `{token}` placeholders the caller passes in
 *      `params`. Used for amounts, names, counts, etc.
 *
 * Callers see one function: `t("path.to.key", { token: "value" })`.
 *
 * Future i18n hook: when we add other locales, the build step picks
 * which defaults file to merge here. The override key shape stays
 * locale-agnostic - merchants type one Hebrew override, not three.
 */

export type KioskOverrides = Record<string, string>;

// `as const` so every leaf is preserved as a literal string. The
// recursive type below relies on this to type the dotted keys.
export const KIOSK_DEFAULTS_HE = {
  start: {
    welcomeFallback: "ברוכים הבאים ל-{tenantName}",
    instruction: "הקישו על המסך כדי להזמין",
    cta: "הזמנה חדשה",
  },
  mode: {
    heading: "איך תרצו לקבל את ההזמנה?",
    dineInTitle: "לשבת במסעדה",
    dineInSubtitle: "אוכל בצלחת + סכו״ם",
    takeawayTitle: "לקחת",
    takeawaySubtitle: "ארוז לדרך",
  },
  phoneEntry: {
    headingRequired: "כדי להתחיל בהזמנה יש להזין טלפון",
    headingOptional: "טלפון לקבלת חשבונית?",
    subtitleRequired:
    "נשלח קוד אימות ל-WhatsApp. נשתמש במספר הטלפון כדי לזהות אתכם ולעדכן אתכם כשההזמנה תהיה מוכנה.",
    subtitleOptional:
      "נשלח לכם באסמס את החשבונית ועדכון כשההזמנה מוכנה. אופציונלי - אפשר לדלג.",
    placeholder: "050-0000000",
    clearKey: "נקה",
    backspaceLabel: "מחק ספרה",
    clearAllLabel: "נקה הכל",
    skipBtn: "דלג",
    continueBtn: "המשך",
    sendingBtn: "שולחים…",
  },
  otp: {
    heading: "הזינו קוד אימות",
    sendingTo: "שולחים קוד ל-",
    sentViaWhatsapp: "שלחנו קוד בוואטסאפ",
    sentViaSms: "שלחנו קוד באסמס",
    sentViaFallback: "שלחנו לכם קוד",
    toLabel: "ל-",
    changePhoneBtn: "שינוי טלפון",
    verifyBtn: "אימות והמשך",
    verifyingBtn: "מאמתים…",
    resendCountdown: "שליחה חוזרת בעוד {seconds} שניות",
    resendNow: "שלחו לי קוד שוב",
    networkError: "שגיאת רשת. נסו שוב.",
    invalidCode: "קוד שגוי",
    deliveryFailed: "לא הצלחנו לשלוח קוד",
  },
  nameEntry: {
    headingPrefilled: "האם השם נכון?",
    headingFresh: "מה השם שלכם?",
    subtitlePrefilled:
      "שלום {name} - נקרא לכם בשם הזה כשההזמנה מוכנה. אפשר לערוך.",
    subtitlePrefilledNoName:
      "נקרא לכם בשם הזה כשההזמנה מוכנה. אפשר לערוך.",
    subtitleFresh: "נקרא לכם בשם כשההזמנה מוכנה.",
    firstNameLabel: "שם פרטי",
    firstNamePlaceholder: "הזינו שם",
    lastNameLabel: "שם משפחה (אופציונלי)",
    lastNamePlaceholder: "הזינו שם משפחה",
    backToCartBtn: "חזרה לעגלה",
    continueBtn: "המשך לתשלום",
  },
  payChoice: {
    heading: "איך נשלם?",
    bumperLabel: "סיום הזמנה",
    totalPrefix: "סה״כ",
    phonePayTitle: "תשלום בטלפון",
    phonePaySubtitle: "סריקת QR · אשראי / Bit / Apple Pay",
    counterPayTitle: "תשלום בקופה",
    counterPaySubtitle: "מזומן / אשראי בקופה",
    backToCartBtn: "חזרה לעגלה",
  },
  payQr: {
    miniHeading: "סרקו לתשלום",
    heading: "סרקו עם הטלפון",
    instructions:
      "פתחו את מצלמת הטלפון, כוונו אל הקוד והשלימו את התשלום.",
    qrGenerating: "יוצר קוד...",
    qrAlt: "QR לתשלום",
    waiting: "ממתינים לתשלום…",
    totalLabel: "סה״כ לתשלום",
    orderNumberLine: "הזמנה #{number}",
    failNote: "לא מצליחים? אפשר לבטל ולשלם בקופה.",
    cancelBtn: "ביטול",
    step1: "סרקו את הקוד עם מצלמת הטלפון",
    step2: "בחרו אמצעי תשלום: אשראי / Bit / Apple Pay",
    step3: "השלימו את התשלום בטלפון",
    step4: "ההזמנה תועבר אוטומטית למטבח",
    step5: "אישור הזמנה יופיע מולכם - תוכלו להוריד חשבונית מס/קבלה",
  },
  thanks: {
    paidViaQrHeading: "התשלום התקבל",
    paidAtCounterHeading: "ההזמנה התקבלה",
    paidViaQrSubtitle: "ההזמנה הועברה למטבח. בתאבון!",
    paidAtCounterSubtitle: "תוכלו לשלם בקופה. בתאבון!",
  },
  header: {
    cancelBtn: "ביטול",
    restartBtn: "התחל מחדש",
    helpAria: "עזרה",
    modeChangeAria: "שינוי בחירת ישיבה/לקיחה",
    dineInChip: "לשבת",
    takeawayChip: "לקחת",
    startBtnAria: "התחל הזמנה חדשה",
  },
  featured: {
    fallbackLabel: "מומלץ של השף",
  },
  browse: {
    searchPlaceholder: "חיפוש בתפריט",
    clearSearchAria: "נקה חיפוש",
    noMatch: 'לא נמצאו פריטים עבור "{query}"',
    emptyCategory: "אין פריטים בקטגוריה הזו",
  },
  cart: {
    openAria: "פתח עגלה",
    emptyAria: "העגלה ריקה",
    emptyCta: "הוסיפו פריט כדי להזמין",
    viewCart: "לצפייה בעגלה",
    sectionLabel: "ההזמנה שלך",
    itemSingular: "פריט",
    itemPlural: "פריטים",
    closeAria: "סגור",
    emptyState: "הסל ריק",
    removeAria: "הסר",
    decrementAria: "הפחת",
    incrementAria: "הוסף",
    totalLabel: "סה״כ",
    checkoutBtn: "מעבר לתשלום",
    continueBrowsingBtn: "המשך לקנות",
  },
  bundle: {
    sectionTitle: "מבצעים פתוחים בסל",
    savingsLabel: "חוסכים {amount}",
    addBtn: "תוסיפו",
    addedBtn: "נוסף",
  },
  upsell: {
    cartSectionTitle: "להוסיף משהו?",
    addAria: "הוסף {name} לסל",
    addNeedsConfigAria: "הוסף {name} (יש בחירות)",
  },
  checkoutUpsell: {
    heading: "להוסיף משהו לפני שמסיימים?",
    subtitle: "המנות הכי טעימות שלנו לסגירת הארוחה",
    skipBtn: "לא תודה, להזמין",
    backBtn: "חזרה לעגלה",
  },
  help: {
    bumper: "עזרה",
    heading: "איך מזמינים בקיוסק?",
    closeAria: "סגור",
    step1: "בחרו פריט מהתפריט.",
    step2: "בחרו תוספות וגודל אם רוצים.",
    step3: "פתחו את העגלה למטה ולחצו על מעבר לתשלום.",
    step4: "שלמו בטלפון בסריקת QR או בקופה.",
    poweredByLine:
      "מערכת קיוסק חכמה ל-מסעדות מ-QuickFood. רוצים אחת כזו אצלכם?",
    callBtn: "חייגו עכשיו · 054-228-4283",
  },
  placing: {
    heading: "שולחים את ההזמנה…",
    subtitle: "רגע, מעבירים את ההזמנה למטבח",
  },
  picker: {
    backToMenu: "חזרה לתפריט",
    itemNotFound: "פריט לא נמצא",
  },
  diningNote: {
    dineIn: "קיוסק · לשבת במסעדה",
    takeaway: "קיוסק · לקחת",
  },
  errors: {
    placingFailed: "יצירת ההזמנה נכשלה",
    network: "שגיאת רשת. נסו שוב.",
    networkFeminine: "שגיאת רשת. נסי שוב.",
  },
  payPage: {
    payTitle: "תשלום הזמנה",
    orderLine: "{tenantName} · הזמנה #{number}",
    totalLabel: "סה״כ לתשלום",
    openingWindow: "טוען את חלון התשלום...",
    waitingForGrow: "ממתינים לחברת האשראי",
    securityNote: "סליקה מאובטחת. אנא אל תסגרו את החלון עד סיום התשלום.",
    notAvailable: "תשלום אונליין לא זמין כרגע למסעדה זו. נא לפנות לקופה.",
    openFailed: "לא הצלחנו לפתוח את חלון התשלום",
    paymentFailed: "התשלום נכשל",
    network: "שגיאת רשת. נסו שוב.",
    tryAgain: "נסה שוב",
    paidHeading: "התשלום הושלם",
    paidOrderLine: "הזמנה #{number} התקבלה ב{tenantName}.",
    paidAmountLine: "סכום ששולם:",
    canCloseTab: "אפשר לסגור את החלון. ההזמנה כבר נשלחה למטבח.",
    invoiceDownload: "הורדת חשבונית מס/קבלה",
    invoiceGenerating: "מייצרים חשבונית…",
    invoiceWillEmailMasked: "נשלח חשבונית במייל ל-{email} ברגע שתהיה מוכנה.",
    invoiceWillEmail: "נשלח חשבונית במייל ברגע שתהיה מוכנה.",
    canCloseTabShort: "אפשר לסגור את החלון.",
    invoiceContactCta: "תרצו לקבל חשבונית מס/קבלה במייל?",
    invoiceShowFormBtn: "להורדת חשבונית מס",
    invoiceContactHeading: "לאן לשלוח את החשבונית?",
    invoiceContactSubtitle: "נשלח את החשבונית למייל ברגע שתהיה מוכנה.",
    invoiceContactPlaceholder: "name@example.com",
    invoiceContactSendBtn: "שליחה",
    invoiceContactSendingBtn: "שולח…",
    invoiceContactSaveError: "שגיאה בשמירה",
    invoiceWillEmailUnknown: "נשלח לך במייל ל-{email} ברגע שתהיה מוכנה.",
  },
} as const;

// Recursive dotted-key type - produces "start.cta" | "payQr.step1" | …
// directly from the defaults tree so the compiler refuses unknown keys.
type DottedKeys<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : {
      [K in Extract<keyof T, string>]: DottedKeys<
        T[K],
        Prefix extends "" ? K : `${Prefix}.${K}`
      >;
    }[Extract<keyof T, string>];

export type KioskMessageKey = DottedKeys<typeof KIOSK_DEFAULTS_HE>;

function lookupDefault(key: string): string | null {
  const parts = key.split(".");
  let cursor: unknown = KIOSK_DEFAULTS_HE;
  for (const part of parts) {
    if (cursor && typeof cursor === "object" && part in cursor) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof cursor === "string" ? cursor : null;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = params[name];
    return value == null ? match : String(value);
  });
}

/**
 * Build a `t(key, params?)` function bound to a particular tenant's
 * override map. The override map is a flat `{ "dotted.key": "..." }`
 * dict - anything not present falls back to the in-repo default.
 */
export function buildKioskT(overrides: KioskOverrides | null | undefined) {
  const safeOverrides: KioskOverrides = overrides ?? {};
  return function t(
    key: KioskMessageKey,
    params?: Record<string, string | number>,
  ): string {
    const override =
      typeof safeOverrides[key] === "string" ? safeOverrides[key] : null;
    const raw = override ?? lookupDefault(key) ?? key;
    return interpolate(raw, params);
  };
}

export type KioskT = ReturnType<typeof buildKioskT>;

/**
 * Coerce an arbitrary JSON value (e.g. `Tenant.kioskStringOverrides`
 * straight off Prisma) into the flat-string-map shape the helper
 * expects. Anything funny gets dropped silently - we never want a
 * malformed override row to crash a kiosk render.
 */
export function normalizeKioskOverrides(value: unknown): KioskOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: KioskOverrides = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}
