/**
 * Auto-generated storefront legal terms (תקנון) per restaurant.
 *
 * Built to satisfy the Grow / Meshulam payment-processor compliance audit,
 * which requires every selling site to publish a תקנון covering: business
 * identification, age restriction, cancellation policy, delivery policy,
 * product liability and privacy.
 *
 * The output is a lightweight markdown-ish string consumed by
 * <LegalText> (## heading, **bold**, "- " list item, blank line = paragraph).
 * Merchants can override the whole document from the dashboard; when they
 * don't, every store still ships a compliant default filled with its own
 * business details.
 */

export interface TermsContext {
  businessName: string;
  /** ח.פ / ע.מ / מספר עוסק. */
  vatNumber?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** True when the store offers delivery (affects the delivery clause). */
  supportsDelivery?: boolean;
}

function contactLines(ctx: TermsContext): string {
  const rows: string[] = [`- שם העסק: ${ctx.businessName}`];
  if (ctx.vatNumber?.trim()) rows.push(`- ח.פ / עוסק מורשה: ${ctx.vatNumber.trim()}`);
  if (ctx.address?.trim()) rows.push(`- כתובת: ${ctx.address.trim()}`);
  if (ctx.phone?.trim()) rows.push(`- טלפון: ${ctx.phone.trim()}`);
  if (ctx.email?.trim()) rows.push(`- דוא״ל: ${ctx.email.trim()}`);
  return rows.join("\n");
}

export function buildDefaultTerms(ctx: TermsContext): string {
  const name = ctx.businessName?.trim() || "העסק";
  const contactChannel = ctx.phone?.trim()
    ? `בטלפון ${ctx.phone.trim()}`
    : ctx.email?.trim()
      ? `בדוא״ל ${ctx.email.trim()}`
      : "בפרטי הקשר המופיעים מעלה";

  const deliveryClause = ctx.supportsDelivery
    ? `אספקת ההזמנות מתבצעת באמצעות שליחים מטעם ${name} או מטעם מי שהוסמך על ידו, לאזורי החלוקה הפעילים בלבד וכפי שמוצגים בעמוד ההזמנה. זמני האספקה המשוערים מוצגים בעת ביצוע ההזמנה והם הערכה בלבד; ייתכנו עיכובים בשל עומס, מזג אוויר, תקלות או נסיבות שאינן בשליטת העסק. דמי המשלוח, ככל שחלים, מוצגים בעמוד התשלום לפני אישור ההזמנה. ניתן גם לבחור באיסוף עצמי מהעסק, ככל שאפשרות זו מוצגת בעמוד ההזמנה.`
    : `ההזמנות מסופקות באיסוף עצמי מבית העסק או בהתאם לאפשרויות המוצגות בעמוד ההזמנה. זמני ההכנה המשוערים מוצגים בעת ביצוע ההזמנה והם הערכה בלבד; ייתכנו עיכובים בשל עומס או נסיבות שאינן בשליטת העסק.`;

  return [
    `## כללי`,
    `תקנון זה מסדיר את תנאי השימוש והרכישה באתר ההזמנות של ${name} ("האתר"). עצם ביצוע הזמנה באתר מהווה הסכמה מלאה לתנאי תקנון זה. אנא קראו אותו בעיון לפני ביצוע הזמנה. בכל מקום בו נכתב בלשון זכר הכוונה גם ללשון נקבה ולהפך.`,
    ``,
    `פרטי בית העסק:`,
    contactLines(ctx),
    ``,
    `## הגבלת גיל`,
    `הרכישה באתר מותרת לבני 18 ומעלה בלבד. בעצם ביצוע ההזמנה הנך מצהיר/ה כי הינך בן/בת 18 שנים ומעלה וכי הינך כשיר/ה לבצע פעולות משפטיות מחייבות. רכישת מוצרים המוגבלים בגיל על פי דין (ככל שנמכרים) מותנית בכך שהרוכש עומד בתנאי הגיל הקבועים בחוק.`,
    ``,
    `## הזמנות, מחירים ותשלום`,
    `כל המחירים באתר נקובים בשקלים חדשים וכוללים מע״מ כדין, אלא אם צוין אחרת. ${name} רשאי לעדכן את המחירים ואת תפריט המוצרים מעת לעת. ההזמנה תיחשב כמאושרת רק לאחר השלמת תהליך התשלום וקבלת אישור. התשלום מתבצע באמצעי התשלום המוצגים בעמוד התשלום, בסביבה מאובטחת באמצעות ספק סליקה מורשה. במקרה של חוסר זמינות של מוצר לאחר ביצוע ההזמנה, ייצור העסק קשר עם הלקוח לתיאום חלופה או החזר.`,
    ``,
    `## מדיניות אספקת מוצרים`,
    deliveryClause,
    ``,
    `## מדיניות ביטול עסקה והחזרים`,
    `ניתן לבטל הזמנה ללא חיוב כל עוד הכנת ההזמנה טרם החלה, באמצעות פנייה לעסק ${contactChannel} בהקדם האפשרי לאחר ביצוע ההזמנה. בקשת הביטול תיעשה בפנייה ישירה לעסק ותתועד.`,
    ``,
    `מוצרי מזון מוכנים הם "טובין פסידים" כהגדרתם בחוק הגנת הצרכן, התשמ״א-1981 ובתקנות מכוחו, ועל כן לאחר תחילת הכנתם לא ניתן לבטל את ההזמנה ולא תינתן זכות החזרה או החזר בגינם, למעט במקרה של פגם או אי-התאמה במוצר. במקרה של פגם, אי-התאמה או בעיה באיכות המוצר, יש לפנות לעסק ${contactChannel} בסמוך לקבלת ההזמנה, והעסק יפעל לתיקון הבעיה, החלפה או מתן זיכוי/החזר לפי העניין. החזר כספי, ככל שיינתן, יבוצע באמצעי התשלום שבו בוצעה ההזמנה.`,
    ``,
    `## אחריות והגבלת אחריות`,
    `${name} אחראי לאיכות המוצרים הנמכרים על ידו ולהתאמתם להזמנה. מעבר לכך, השימוש באתר ובמוצרים הוא באחריות המשתמש. ${name} לא יישא באחריות לכל נזק עקיף, תוצאתי או מיוחד שייגרם כתוצאה משימוש באתר או במוצרים, ואחריותו לא תעלה על סכום ההזמנה הרלוונטית. על הלקוח חלה האחריות למסור פרטי הזמנה, אספקה ופרטי קשר נכונים ומלאים. מובהר כי על הלקוח לבדוק את רכיבי המוצרים והערות האלרגנים, ככל שמופיעות, ולפנות לעסק בכל שאלה בנוגע לרגישויות או אלרגיות לפני ביצוע ההזמנה.`,
    ``,
    `## פרטיות ואבטחת מידע`,
    `הפרטים האישיים שנמסרים בעת ביצוע ההזמנה (שם, טלפון, כתובת דוא״ל וכתובת למשלוח) נאספים לצורך ביצוע ההזמנה, אספקתה ויצירת קשר עם הלקוח בלבד, ואינם נמסרים לצדדים שלישיים אלא לצורך השלמת ההזמנה (כגון ספק סליקה ושירות שליחויות) או כנדרש על פי דין. המידע נשמר באמצעים מקובלים ובאמצעי אבטחה סבירים כדי להגן עליו מפני גישה או שימוש לא מורשים. דיוור פרסומי יישלח רק ללקוחות שנתנו לכך את הסכמתם, וניתן להסיר את ההסכמה בכל עת.`,
    ``,
    `## יצירת קשר וסמכות שיפוט`,
    `בכל שאלה, בקשה או תלונה ניתן לפנות אל ${name} ${contactChannel}. על תקנון זה יחולו דיני מדינת ישראל, וסמכות השיפוט הבלעדית בכל עניין הנוגע לו תהא נתונה לבתי המשפט המוסמכים בישראל.`,
  ].join("\n");
}

/** The text to render: merchant override when present, else the default. */
export function resolveTerms(
  override: string | null | undefined,
  ctx: TermsContext,
): string {
  const trimmed = override?.trim();
  return trimmed ? trimmed : buildDefaultTerms(ctx);
}
