export interface LandingCopy {
  headline: string;
  body: string;
  cta: string;
}

export const LANDING_TEMPLATES = [
  "bag_insert",
  "receipt_vip",
  "marketplace_convert",
  "walk_in",
  "birthday",
  "referral",
  "cashback",
  "vip",
  "first_direct_order",
  "delivery_box",
  "takeaway",
  "google_business",
  "instagram_story",
  "tiktok",
  "whatsapp",
  "email",
  "dine_in",
  "review_request",
] as const;
export type LandingTemplate = (typeof LANDING_TEMPLATES)[number];

export const LANDING_TEMPLATE_LABELS: Record<LandingTemplate, string> = {
  bag_insert: "מדבקה לשקית משלוח",
  receipt_vip: "QR על הקבלה - מועדון",
  marketplace_convert: "המרת לקוח מאפליקציה",
  walk_in: "לקוח מזדמן בחנות",
  birthday: "יום הולדת",
  referral: "חבר מביא חבר",
  cashback: "צ׳אקבק / החזר כספי",
  vip: "לקוח VIP",
  first_direct_order: "הזמנה ישירה ראשונה",
  delivery_box: "מדבקה לארגז משלוח",
  takeaway: "טייק אווי",
  google_business: "פרופיל עסק בגוגל",
  instagram_story: "סטורי באינסטגרם",
  tiktok: "טיקטוק",
  whatsapp: "וואטסאפ",
  email: "אימייל",
  dine_in: "ישיבה במקום",
  review_request: "בקשת ביקורת",
};

// Default copy per template. Editable per campaign via QrCampaign.landingCopy.
const DEFAULTS: Record<LandingTemplate, (business: string) => LandingCopy> = {
  bag_insert: (b) => ({
    headline: "תודה שהזמנת!",
    body: `בפעם הבאה הזמינו ישירות מהאתר של ${b} ותיהנו מהטבה מיוחדת - בלי עמלות, ישר אלינו.`,
    cta: "להזמנה ישירה",
  }),
  receipt_vip: (b) => ({
    headline: "הצטרפו למועדון",
    body: `הצטרפו למועדון של ${b} וקבלו קופון יום הולדת ונקודות על כל הזמנה.`,
    cta: "הצטרפות למועדון",
  }),
  marketplace_convert: (b) => ({
    headline: "מזמינים ישירות בפעם הראשונה?",
    body: `קבלו הטבה מיוחדת על ההזמנה הבאה ישירות מהאתר של ${b}.`,
    cta: "קבלו את ההטבה",
  }),
  walk_in: (b) => ({
    headline: "ברוכים הבאים!",
    body: `סרקו, הצטרפו למועדון של ${b}, ותתחילו לצבור נקודות על כל הזמנה.`,
    cta: "להזמנה ולמועדון",
  }),
  birthday: () => ({
    headline: "מזל טוב!",
    body: "חוגגים? מגיעה לכם הטבת יום הולדת מיוחדת על ההזמנה הבאה.",
    cta: "לממש את ההטבה",
  }),
  referral: (b) => ({
    headline: "חבר מביא חבר",
    body: `אהבתם את ${b}? שתפו חברים - וגם אתם וגם הם תקבלו הטבה על ההזמנה הבאה.`,
    cta: "להזמין ולשתף",
  }),
  cashback: () => ({
    headline: "כל הזמנה מחזירה לכם",
    body: "הזמינו ישירות מהאתר וצברו החזר כספי שתוכלו לממש בהזמנה הבאה.",
    cta: "להתחיל לצבור",
  }),
  vip: (b) => ({
    headline: "מועדון ה-VIP",
    body: `הלקוחות הכי נאמנים של ${b} מקבלים הטבות בלעדיות. הצטרפו ותהנו מהן גם אתם.`,
    cta: "להצטרף ל-VIP",
  }),
  first_direct_order: (b) => ({
    headline: "ההזמנה הישירה הראשונה שלכם",
    body: `מזמינים בפעם הראשונה ישירות מ-${b}? מחכה לכם הטבה מיוחדת.`,
    cta: "להתחיל הזמנה",
  }),
  delivery_box: (b) => ({
    headline: "המשלוח הבא - ישירות",
    body: `הזמינו ישירות מ-${b} ותיהנו ממחיר טוב יותר, בלי דמי שירות של אפליקציה.`,
    cta: "להזמנה ישירה",
  }),
  takeaway: () => ({
    headline: "טייק אווי בקליק",
    body: "הזמינו מראש, דלגו על התור, ואספו כשמוכן.",
    cta: "להזמין טייק אווי",
  }),
  google_business: (b) => ({
    headline: `מצאתם אותנו בגוגל?`,
    body: `הזמינו ישירות מהאתר הרשמי של ${b} - מהיר, נוח, בלי מתווכים.`,
    cta: "להזמנה",
  }),
  instagram_story: (b) => ({
    headline: "הגעתם מהסטורי",
    body: `נחמד שהצטרפתם! הזמינו ישירות מ-${b} וקבלו הטבה.`,
    cta: "להזמנה",
  }),
  tiktok: (b) => ({
    headline: "ראיתם אותנו בטיקטוק",
    body: `מסקרן אתכם? בואו לטעום - הזמינו ישירות מ-${b}.`,
    cta: "להזמנה",
  }),
  whatsapp: (b) => ({
    headline: "שלום מ-WhatsApp",
    body: `כיף שאתם כאן! הזמינו ישירות מ-${b} וקבלו הטבה.`,
    cta: "להזמנה",
  }),
  email: (b) => ({
    headline: "המשך מהמייל",
    body: `הזמינו ישירות מ-${b} ותהנו מההטבה ששלחנו לכם.`,
    cta: "לממש",
  }),
  dine_in: (b) => ({
    headline: "תהנו מהארוחה!",
    body: `אהבתם? בפעם הבאה הזמינו הביתה ישירות מ-${b}, או הצטרפו למועדון עכשיו.`,
    cta: "להצטרף למועדון",
  }),
  review_request: (b) => ({
    headline: "איך היה?",
    body: `נשמח לשמוע מה דעתכם על ${b} - וגם להזכיר שאפשר להזמין ישירות בפעם הבאה.`,
    cta: "להזמנה ישירה",
  }),
};

export function resolveLandingCopy(
  template: string | null,
  raw: unknown,
  business: string,
): LandingCopy {
  const tpl = (LANDING_TEMPLATES as readonly string[]).includes(template ?? "")
    ? (template as LandingTemplate)
    : "bag_insert";
  const base = DEFAULTS[tpl](business);
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<LandingCopy>;
  return {
    headline: typeof obj.headline === "string" && obj.headline.trim() ? obj.headline : base.headline,
    body: typeof obj.body === "string" && obj.body.trim() ? obj.body : base.body,
    cta: typeof obj.cta === "string" && obj.cta.trim() ? obj.cta : base.cta,
  };
}
