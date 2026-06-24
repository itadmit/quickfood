/**
 * RTL-first Hebrew email templates.
 *
 * Every QuickFood email goes through `renderRtlEmail` so the root `<html>`,
 * `<body>`, and wrapper `<div>` all carry `dir="rtl"` and `lang="he"`. Gmail
 * and most clients strip <head> styles, so we inline everything important and
 * also set inline `text-align: right` / `direction: rtl` on the containers.
 */

// Brand palette mirrors the V2 dashboard: bold yellow surface + cream
// card + black ink/borders. Email-safe - no gradients, no box-shadows,
// no rgba/CSS variables (Outlook strips them all).
const BRAND = {
  yellow: "#F8CB1E",
  cream: "#FFFBEC",
  card: "#FFFFFF",
  ink: "#000000",
  ink2: "#1a1a1a",
  mute: "#5a5a5a",
  line: "#000000",
  buttonBg: "#000000",
  buttonText: "#F8CB1E",
  waGreen: "#25D366",
};

// Public origin used for email-embedded assets - must be reachable from the
// recipient's inbox, NOT localhost. Gmail strips data: URIs in <img>, so the
// WhatsApp glyph must be hosted at an absolute https URL.
const EMAIL_ASSETS_BASE = (process.env.EMAIL_ASSETS_BASE ?? "https://quickfood.co.il").replace(
  /\/$/,
  "",
);

// White WhatsApp glyph (PNG, 64×64) hosted under /public/img/.
const WA_ICON_IMG = `<img src="${EMAIL_ASSETS_BASE}/img/whatsapp-white.png" width="18" height="18" alt="" style="vertical-align:middle;display:inline-block;border:0;">`;

function escape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface EmailButton {
  href: string;
  label: string;
}

export interface RtlEmailOptions {
  /** Email subject - repeated in the preheader for some clients. */
  subject: string;
  /** Hidden 1-line preview shown in inbox listings. */
  preheader?: string;
  /** Big heading shown at the top of the card. */
  heading: string;
  /** Body paragraphs (already-escaped HTML allowed if you pass `raw: true`). */
  paragraphs: string[];
  /** Optional primary CTA button. */
  button?: EmailButton;
  /** Optional small footer note (escaped). */
  footerNote?: string;
  /** Brand shown in the header pill + footer line. Defaults to "QuickFood".
   *  Customer-facing emails pass the business name so the email reads as
   *  coming from the restaurant, not the platform. */
  brand?: string;
  /** If true, treat paragraphs as raw HTML (caller is responsible for escaping). */
  raw?: boolean;
  /** Optional raw HTML rendered between the primary button and the footer note -
   *  used for secondary CTAs like the WhatsApp support button. Caller is
   *  responsible for escaping any dynamic values. */
  tail?: string;
  /** Optional secondary WhatsApp button (green pill, white icon). Rendered
   *  inside `tail` slot if `tail` is not provided directly. */
  whatsappButton?: { href: string; label: string };
}

export function renderRtlEmail(opts: RtlEmailOptions): { html: string; text: string } {
  const brand = opts.brand ?? "QuickFood";
  const paragraphs = opts.paragraphs
    .map((p) => `<p dir="rtl" style="margin:0 0 14px;line-height:1.65;color:${BRAND.ink2};font-size:15px;direction:rtl;text-align:right;">${opts.raw ? p : escape(p)}</p>`)
    .join("");

  // Black-on-yellow chunky button - matches the dashboard's V2 brand
  // (yellow surface, black CTA with bold yellow text). Email-safe:
  // solid background color, no gradients, no box-shadow.
  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:24px auto;">
        <tr>
          <td align="center" bgcolor="${BRAND.buttonBg}" style="border-radius:12px;border:2px solid ${BRAND.line};">
            <a href="${escape(opts.button.href)}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 32px;font-family:inherit;font-size:15px;font-weight:800;color:${BRAND.buttonText};text-decoration:none;border-radius:10px;letter-spacing:.2px;">
              ${escape(opts.button.label)}
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;visibility:hidden;opacity:0;color:transparent;line-height:0;font-size:0;">${escape(opts.preheader)}</div>`
    : "";

  const footerNote = opts.footerNote
    ? `<p dir="rtl" style="margin:18px 0 0;font-size:12px;color:${BRAND.mute};line-height:1.5;direction:rtl;text-align:right;">${escape(opts.footerNote)}</p>`
    : "";

  // Secondary WhatsApp CTA - green pill with white WhatsApp glyph + label,
  // chunky black border + flat black shadow (mirrors the support FAB used in
  // the customer UI). Email-safe table layout; clients that strip box-shadow
  // (Outlook desktop) still see the green pill with border.
  const waButton = opts.whatsappButton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:14px auto 0;">
        <tr>
          <td align="center" bgcolor="${BRAND.waGreen}" style="background-color:${BRAND.waGreen};border:2px solid ${BRAND.line};border-radius:999px;box-shadow:3px 3px 0 0 ${BRAND.line};">
            <a href="${escape(opts.whatsappButton.href)}" target="_blank" rel="noopener" style="display:inline-block;padding:11px 22px;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;font-family:inherit;direction:rtl;line-height:1;">
              <span style="vertical-align:middle;">${WA_ICON_IMG}</span>
              <span style="vertical-align:middle;margin-right:8px;">${escape(opts.whatsappButton.label)}</span>
            </a>
          </td>
        </tr>
      </table>`
    : "";

  const tail = opts.tail ?? "";

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(opts.subject)}</title>
</head>
<body dir="rtl" style="margin:0;padding:0;background-color:${BRAND.cream};font-family:'Segoe UI',Tahoma,Arial,'Helvetica Neue',Helvetica,sans-serif;color:${BRAND.ink};direction:rtl;text-align:right;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" bgcolor="${BRAND.cream}" style="background-color:${BRAND.cream};padding:28px 12px;direction:rtl;">
  <tr>
    <td align="center" dir="rtl">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="max-width:560px;width:100%;background:${BRAND.card};border:2px solid ${BRAND.line};border-radius:20px;overflow:hidden;direction:rtl;text-align:right;">
        <tr>
          <td bgcolor="${BRAND.yellow}" style="background-color:${BRAND.yellow};padding:24px 28px;text-align:right;direction:rtl;border-bottom:2px solid ${BRAND.line};">
            <div style="font-size:12px;font-weight:900;color:${BRAND.ink};letter-spacing:1.5px;text-transform:uppercase;">${escape(brand)}</div>
            <div style="font-size:22px;font-weight:900;color:${BRAND.ink};margin-top:8px;line-height:1.25;">${escape(opts.heading)}</div>
          </td>
        </tr>
        <tr>
          <td bgcolor="${BRAND.card}" style="background-color:${BRAND.card};padding:28px;direction:rtl;text-align:right;color:${BRAND.ink2};">
            ${paragraphs}
            ${button}
            ${tail}
            ${waButton}
            ${footerNote}
          </td>
        </tr>
        <tr>
          <td bgcolor="${BRAND.card}" style="background-color:${BRAND.card};padding:18px 28px;border-top:2px solid ${BRAND.line};direction:rtl;text-align:right;">
            <div style="font-size:12px;color:${BRAND.mute};line-height:1.5;">
              מייל זה נשלח אוטומטית מ-${escape(brand)}. אין להשיב למייל זה.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  // Plaintext fallback - same content, no HTML.
  const textParts: string[] = [opts.heading, "", ...opts.paragraphs];
  if (opts.button) textParts.push("", `${opts.button.label}: ${opts.button.href}`);
  if (opts.whatsappButton) {
    textParts.push("", `${opts.whatsappButton.label}: ${opts.whatsappButton.href}`);
  }
  if (opts.footerNote) textParts.push("", opts.footerNote);
  textParts.push("", "-", brand);
  const text = textParts.join("\n");

  return { html, text };
}

export function welcomeEmail({
  ownerName,
  businessName,
  dashboardUrl,
  supportPhone = "972552554432",
}: {
  ownerName: string;
  businessName: string;
  dashboardUrl: string;
  /** Israeli mobile in E.164 without the +. Default is the QuickFood support line. */
  supportPhone?: string;
}) {
  const waText = `שלום, אני *${ownerName}* במערכת קוויק פוד אשמח לעזרה`;
  const waUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(waText)}`;

  return renderRtlEmail({
    subject: `ברוכים הבאים ל-QuickFood, ${businessName}!`,
    preheader: "החנות שלך מוכנה. הצעדים הראשונים מחכים בדשבורד.",
    heading: `שלום ${ownerName}, ברוכים הבאים!`,
    raw: true,
    paragraphs: [
      `החנות <strong>${escape(businessName)}</strong> נוצרה בהצלחה ב-QuickFood.`,
      "התחלת תקופת ניסיון של 7 ימים - בלי כרטיס אשראי, גישה מלאה לכל הפיצ׳רים.",
      `צעדים מומלצים ראשונים (אם לא ייבאת עדיין תפריט מוולט):
       <ul dir="rtl" style="margin:8px 0 0;padding:0 22px 0 0;line-height:1.7;color:${BRAND.ink2};font-size:15px;direction:rtl;text-align:right;list-style-position:outside;">
         <li style="margin:0 0 4px;">הוסיפו תפריט</li>
         <li style="margin:0 0 4px;">הגדירו שעות פעילות</li>
         <li style="margin:0 0 4px;">הגדירו אמצעי תשלום</li>
         <li style="margin:0;">שתפו את ה-QR קוד של החנות עם הלקוחות</li>
       </ul>`,
    ],
    button: { href: dashboardUrl, label: "כניסה לדשבורד" },
    tail: `<p dir="rtl" style="margin:22px 0 0;line-height:1.5;color:${BRAND.ink2};font-size:15px;font-weight:700;direction:rtl;text-align:center;">צריכים עזרה?</p>`,
    whatsappButton: {
      href: waUrl,
      label: "לחצו כאן למעבר לתמיכה מהירה בוואטסאפ!",
    },
  });
}

export function signupFollowupEmail({
  ownerName,
  businessName,
  dashboardUrl,
  hasMenuItems,
  hasPayments,
  growSignupUrl,
  supportPhone = "972552554432",
}: {
  ownerName: string;
  businessName: string;
  dashboardUrl: string;
  /** Tenant already has at least one menu item - flips the opening copy. */
  hasMenuItems: boolean;
  /** Tenant already has an active clearing provider - hides the Grow pitch. */
  hasPayments: boolean;
  growSignupUrl: string;
  /** Israeli mobile in E.164 without the +. Default is the QuickFood support line. */
  supportPhone?: string;
}) {
  const waText = `שלום, אני *${ownerName}* במערכת קוויק פוד אשמח לעזרה`;
  const waUrl = `https://wa.me/${supportPhone}?text=${encodeURIComponent(waText)}`;

  const opener = hasMenuItems
    ? `ראינו שכבר התחלת להזין את התפריט של <strong>${escape(businessName)}</strong> - מעולה, זה החלק הכי גדול בהקמה.`
    : `עברה שעה מאז שפתחת את <strong>${escape(businessName)}</strong> ב-QuickFood, ורצינו לבדוק שהכל זורם. אם משהו מסתבך בהקמת התפריט - אפשר גם לייבא הכל מוולט בלחיצה אחת מהדשבורד.`;

  const growBox = `<div dir="rtl" style="margin:4px 0 0;padding:18px;border:2px solid ${BRAND.line};border-radius:14px;background:${BRAND.cream};direction:rtl;text-align:right;">
      <div style="font-size:16px;font-weight:900;color:${BRAND.ink};margin:0 0 6px;">עוד לא חיברת חברת סליקה?</div>
      <p dir="rtl" style="margin:0;line-height:1.65;color:${BRAND.ink2};font-size:14px;direction:rtl;text-align:right;">כדי לקבל תשלומים באשראי, Bit ו-Apple Pay צריך חשבון סליקה - ואנחנו ממליצים על Grow. משאירים פרטים בטופס הקצר, ו-Grow ישלחו אליך את כל הטפסים דיגיטלית. בלי ניירת ובלי התרוצצויות.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:16px auto 0;">
        <tr>
          <td align="center" bgcolor="${BRAND.yellow}" style="background-color:${BRAND.yellow};border-radius:12px;border:2px solid ${BRAND.line};">
            <a href="${escape(growSignupUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 30px;font-family:inherit;font-size:14px;font-weight:800;color:${BRAND.ink};text-decoration:none;border-radius:10px;letter-spacing:.2px;">הרשמה מהירה ל-Grow</a>
          </td>
        </tr>
      </table>
    </div>`;

  return renderRtlEmail({
    subject: `${ownerName}, איך מתקדמת ההקמה של ${businessName}?`,
    preheader: "שעה עברה מההרשמה - באנו לבדוק שהכל זורם ולעזור אם צריך.",
    heading: `${ownerName}, איך הולך?`,
    raw: true,
    paragraphs: [
      opener,
      ...(hasPayments ? [] : [growBox]),
    ],
    button: { href: dashboardUrl, label: "כניסה לדשבורד" },
    tail: `<p dir="rtl" style="margin:22px 0 0;line-height:1.5;color:${BRAND.ink2};font-size:15px;font-weight:700;direction:rtl;text-align:center;">נתקעת או שיש שאלה?</p>`,
    whatsappButton: {
      href: waUrl,
      label: "לחצו כאן למעבר לתמיכה מהירה בוואטסאפ!",
    },
  });
}

export function merchantSignupAdminEmail({
  businessName,
  slug,
  ownerName,
  ownerEmail,
  ownerPhone,
  branchAddress,
  branchPhone,
  businessType,
  storeUrl,
}: {
  businessName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  branchAddress: string;
  branchPhone: string;
  businessType: string;
  storeUrl: string;
}) {
  const rows: Array<[string, string]> = [
    ["שם העסק", businessName],
    ["כתובת באתר", slug],
    ["סוג עסק", businessType],
    ["שם הבעלים", ownerName],
    ["אימייל", ownerEmail],
    ...(ownerPhone ? [["מובייל בעלים", ownerPhone] as [string, string]] : []),
    ["טלפון סניף", branchPhone],
    ["כתובת סניף", branchAddress],
  ];
  const table = `<table dir="rtl" cellpadding="0" cellspacing="0" border="0" style="width:100%;direction:rtl;text-align:right;border-collapse:collapse;margin:4px 0 0;">
    ${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:7px 0;font-size:14px;color:${BRAND.mute};width:110px;vertical-align:top;">${escape(k)}</td><td style="padding:7px 0;font-size:15px;font-weight:700;color:${BRAND.ink2};">${escape(v)}</td></tr>`,
      )
      .join("")}
  </table>`;

  return renderRtlEmail({
    subject: `סוחר חדש נרשם: ${businessName}`,
    preheader: `${businessName} (${slug}) השלים הרשמה ל-QuickFood.`,
    heading: "סוחר חדש נרשם",
    raw: true,
    paragraphs: [`נרשם עסק חדש למערכת:`, table],
    button: { href: storeUrl, label: "צפייה בחנות" },
  });
}

export function passwordResetEmail({
  ownerName,
  resetUrl,
  expiresInMinutes,
}: {
  ownerName: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  return renderRtlEmail({
    subject: "איפוס סיסמה ל-QuickFood",
    preheader: "ביקשת לאפס את הסיסמה. הלינק תקף לזמן מוגבל.",
    heading: "איפוס סיסמה",
    paragraphs: [
      `שלום ${ownerName},`,
      "קיבלנו בקשה לאפס את הסיסמה לחשבון שלך ב-QuickFood. אפשר לבחור סיסמה חדשה דרך הקישור למטה.",
      `הקישור תקף ל-${expiresInMinutes} דקות מרגע השליחה.`,
    ],
    button: { href: resetUrl, label: "בחירת סיסמה חדשה" },
    footerNote:
      "לא ביקשת לאפס סיסמה? אפשר להתעלם מהמייל - הסיסמה הקיימת נשארת בתוקף.",
  });
}

export function courierMagicLinkEmail({
  courierName,
  businessName,
  loginUrl,
  expiresInMinutes,
}: {
  courierName: string;
  businessName: string;
  loginUrl: string;
  expiresInMinutes: number;
}) {
  return renderRtlEmail({
    subject: `התחברות לאפליקציית השליחים של ${businessName}`,
    preheader: "לחיצה אחת מחברת אותך לאפליקציה.",
    heading: `שלום ${courierName}`,
    paragraphs: [
      `קיבלת קישור התחברות לאפליקציית השליחים של ${businessName}.`,
      `הקישור תקף ל-${expiresInMinutes} דקות. אחרי הלחיצה תוכנס ישירות לאפליקציה ותראה את ההזמנות שלך.`,
    ],
    button: { href: loginUrl, label: "התחבר עכשיו" },
    footerNote:
      "לא ביקשת להתחבר? אפשר להתעלם מהמייל. הקישור פג בעצמו אחרי דקות ספורות.",
  });
}

export function verifyEmailEmail({
  ownerName,
  businessName,
  verifyUrl,
  expiresInHours,
}: {
  ownerName: string;
  businessName: string;
  verifyUrl: string;
  expiresInHours: number;
}) {
  return renderRtlEmail({
    subject: `הפעלת החנות ${businessName} ב-QuickFood`,
    preheader: "לחיצה אחת מפעילה את הגישה המלאה לחשבון.",
    heading: `שלום ${ownerName}, נשאר רק לאמת מייל`,
    raw: true,
    paragraphs: [
      `החנות <strong>${escape(businessName)}</strong> נוצרה ב-QuickFood, אבל לפני שתופיע כפעילה ללקוחות צריך לאמת שהמייל הזה באמת שלך.`,
      "לחיצה על הכפתור שמתחת מאמתת את הכתובת ומסירה את ההתראה מהדשבורד - זה לוקח שנייה.",
      `הקישור תקף ל-${expiresInHours} שעות. אם הקישור פג תוקף, אפשר לבקש קישור חדש מהכפתור שבראש הדשבורד.`,
    ],
    button: { href: verifyUrl, label: "אמת את החשבון" },
    footerNote:
      "לא נרשמת ל-QuickFood? אפשר להתעלם מהמייל הזה - בלי אימות החשבון יישאר מסומן ולא יבוצעו בו פעולות בשמך.",
  });
}

export function testEmail({ recipient }: { recipient: string }) {
  return renderRtlEmail({
    subject: "QuickFood - בדיקת מייל",
    preheader: "אם קיבלת את זה, Resend מחובר נכון.",
    heading: "הצלחה! המייל הגיע.",
    paragraphs: [
      `שלחנו את המייל הזה אל ${recipient} כדי לאמת שההגדרות של Resend ושל הדומיין quickfood.co.il עובדות כמו שצריך.`,
      "אפשר להתעלם מהמייל - שום פעולה לא דרושה.",
    ],
    footerNote: "סטטוס: מערכת המיילים פעילה.",
  });
}

export function reviewReminderEmail({
  hello,
  businessName,
  reviewUrl,
}: {
  hello: string;
  businessName: string;
  reviewUrl: string;
}) {
  // Each star prelinks the review form with a chosen rating so the customer
  // lands on the form with their selection already applied.
  const starsRow = (() => {
    const [path, hash = ""] = reviewUrl.split("#");
    const sep = path.includes("?") ? "&" : "?";
    const cells: string[] = [];
    for (let n = 1; n <= 5; n++) {
      const href = `${path}${sep}rating=${n}${hash ? `#${hash}` : ""}`;
      cells.push(
        `<td align="center" style="padding:0 4px;text-align:center;"><a href="${escape(href)}" target="_blank" rel="noopener" aria-label="${n} כוכבים" style="text-decoration:none;display:inline-block;color:${BRAND.mute};"><img src="${EMAIL_ASSETS_BASE}/img/star-yellow.png" width="32" height="32" alt="${n}" style="display:block;border:0;margin:0 auto;"><div style="font-size:11px;font-weight:700;color:${BRAND.mute};line-height:1;margin-top:4px;">${n}</div></a></td>`,
      );
    }
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" dir="ltr" style="margin:8px auto 0;direction:ltr;"><tr>${cells.join("")}</tr></table>`;
  })();

  return renderRtlEmail({
    brand: businessName,
    subject: `איך הייתה ההזמנה מ-${businessName}?`,
    preheader: "דקה אחת לדרג - עוזר למסעדה ולסועדים הבאים.",
    heading: `${hello}, איך הייתה ההזמנה?`,
    raw: true,
    paragraphs: [
      `תודה שהזמנת מ-<strong>${escape(businessName)}</strong>.`,
      "נשמח לשמוע איך היה - זה בול דקה אחת לדרג, וזה יעזור לנו ללמוד ולהשתפר לפעם הבאה!",
      starsRow,
    ],
    button: { href: reviewUrl, label: "דרגו את ההזמנה" },
    footerNote: "ב-תיאבון!",
  });
}

export function reviewReplyEmail({
  hello,
  businessName,
  customerRating,
  customerText,
  replyText,
  viewUrl,
}: {
  hello: string;
  businessName: string;
  customerRating: number;
  customerText: string | null;
  replyText: string;
  viewUrl: string;
}) {
  // Render the customer's original review (stars + their text, if any) as a
  // quoted block, then the merchant's reply as a highlighted card so the
  // recipient sees the conversation in context.
  const stars = (() => {
    const cells: string[] = [];
    for (let n = 1; n <= 5; n++) {
      const filled = n <= customerRating;
      cells.push(
        `<td style="padding:0 1px;"><img src="${EMAIL_ASSETS_BASE}/img/star-yellow.png" width="18" height="18" alt="" style="display:block;border:0;${filled ? "" : "opacity:0.25;"}"></td>`,
      );
    }
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right" dir="ltr" style="direction:ltr;margin-bottom:6px;"><tr>${cells.join("")}</tr></table>`;
  })();

  const yourReviewBlock = `<div style="background:${BRAND.cream};border:1px solid ${BRAND.line};border-radius:10px;padding:12px 14px;margin-top:8px;text-align:right;direction:rtl;">
    <div style="font-size:12px;font-weight:700;color:${BRAND.mute};margin-bottom:4px;">הביקורת שלך</div>
    ${stars}
    ${customerText ? `<div style="font-size:14px;color:${BRAND.ink2};line-height:1.5;">${escape(customerText)}</div>` : ""}
  </div>`;

  const replyBlock = `<div style="background:${BRAND.yellow};border:2px solid ${BRAND.line};border-radius:10px;padding:12px 14px;margin-top:12px;text-align:right;direction:rtl;">
    <div style="font-size:12px;font-weight:700;color:${BRAND.ink};margin-bottom:4px;">תשובת ${escape(businessName)}</div>
    <div style="font-size:14px;color:${BRAND.ink};line-height:1.5;">${escape(replyText)}</div>
  </div>`;

  return renderRtlEmail({
    brand: businessName,
    subject: `${businessName} השיב/ה לדירוג שלך`,
    preheader: "המסעדה הגיבה לביקורת שכתבת.",
    heading: `${hello}, יש לך תשובה מהמסעדה`,
    raw: true,
    paragraphs: [
      `<strong>${escape(businessName)}</strong> ראה/תה את הביקורת שלך והגיב/ה.`,
      yourReviewBlock,
      replyBlock,
    ],
    button: { href: viewUrl, label: "צפו בביקורת" },
    footerNote: "תודה שעזרת למסעדה להשתפר.",
  });
}

export function courierWelcomeEmail({
  courierName,
  businessName,
  loginUrl,
  loginIdentifier,
  pin,
  ttlMinutes,
  appUrl,
}: {
  courierName: string;
  businessName: string;
  /** One-shot magic-link URL - opens, signs in, expires after ttlMinutes. */
  loginUrl: string;
  /** The phone / email the courier types on /courier/login if the magic
   *  link expires. We show whichever the merchant has stored. */
  loginIdentifier: string;
  pin: string;
  ttlMinutes: number;
  /** Plain `/courier/login` URL for the long-term sign-in instructions. */
  appUrl: string;
}) {
  const credsBlock = `<div style="background:${BRAND.cream};border:1px solid ${BRAND.line};border-radius:10px;padding:14px 16px;margin-top:8px;text-align:right;direction:rtl;">
    <div style="font-size:12px;font-weight:700;color:${BRAND.mute};margin-bottom:8px;">פרטי כניסה (לזכור)</div>
    <div style="font-size:14px;color:${BRAND.ink2};line-height:1.7;">
      <div><span style="color:${BRAND.mute};">מזהה:</span> <span dir="ltr" style="display:inline-block;font-weight:700;">${escape(loginIdentifier)}</span></div>
      <div><span style="color:${BRAND.mute};">קוד PIN:</span> <span dir="ltr" style="display:inline-block;font-weight:700;letter-spacing:2px;font-size:18px;">${escape(pin)}</span></div>
      <div style="margin-top:6px;"><span style="color:${BRAND.mute};">כתובת הכניסה:</span> <a href="${escape(appUrl)}" style="color:${BRAND.ink};">${escape(appUrl)}</a></div>
    </div>
  </div>`;

  return renderRtlEmail({
    subject: `נוצר לך חשבון שליח אצל ${businessName}`,
    preheader: "קישור חד-פעמי להתחברות + פרטי הכניסה הקבועים.",
    heading: `שלום ${courierName}, ברוך/ה הבא/ה`,
    raw: true,
    paragraphs: [
      `<strong>${escape(businessName)}</strong> הוסיפ/ה אותך כשליח/ה במערכת QuickFood.`,
      `לחיצה על הכפתור למטה מבצעת התחברות מיידית - הקישור תקף ${ttlMinutes} דקות והוא חד-פעמי.`,
      credsBlock,
      `אחרי תוקף הקישור - היכנס/י בכתובת למעלה עם המזהה וה־PIN שלך. אם איבדת את ה־PIN, בקש/י ממנהל/ת המסעדה איפוס.`,
    ],
    button: { href: loginUrl, label: "כניסה לאפליקציית השליחים" },
    footerNote: "בהצלחה!",
  });
}

export function leadEmail({
  name,
  restaurant,
  email,
  phone,
  message,
  source,
  ip,
}: {
  name: string;
  restaurant?: string;
  email: string;
  phone?: string;
  message?: string;
  source: string;
  ip: string;
}) {
  // Detail table rendered as raw HTML inside one paragraph slot, so it keeps
  // the brand card layout (same as every other email).
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;color:${BRAND.mute};white-space:nowrap;">${escape(label)}</td><td style="padding:4px 0;color:${BRAND.ink2};">${value}</td></tr>`;

  const detailsTable = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="margin:6px 0 0;border-collapse:collapse;direction:rtl;text-align:right;font-size:14px;">
    ${row("שם", escape(name))}
    ${restaurant ? row("מסעדה", escape(restaurant)) : ""}
    ${row("מייל", `<a href="mailto:${escape(email)}" style="color:${BRAND.ink};text-decoration:underline;">${escape(email)}</a>`)}
    ${phone ? row("טלפון", `<a href="tel:${escape(phone)}" style="color:${BRAND.ink};text-decoration:underline;">${escape(phone)}</a>`) : ""}
  </table>`;

  const messageBlock = message
    ? `<div dir="rtl" style="margin:14px 0 0;padding:12px;background:${BRAND.cream};border:1px solid ${BRAND.line};border-radius:10px;white-space:pre-wrap;direction:rtl;text-align:right;color:${BRAND.ink2};font-size:14px;line-height:1.55;">${escape(message)}</div>`
    : "";

  return renderRtlEmail({
    subject: `ליד חדש: ${name}${restaurant ? ` · ${restaurant}` : ""}`,
    preheader: `מקור: ${source}`,
    heading: "ליד חדש מהאתר",
    raw: true,
    paragraphs: [
      `התקבלה פנייה חדשה מ-<strong>${escape(source)}</strong>:`,
      detailsTable,
      messageBlock || "(לא נשלחה הודעה)",
    ],
    footerNote: `IP: ${ip}`,
  });
}

export interface OrderConfirmedItem {
  name: string;
  size?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
  options?: Array<{ name: string; priceDelta: number }>;
}

function formatShekels(amount: number): string {
  return `${amount.toLocaleString("he-IL")} ש"ח`;
}

function itemsTable(items: OrderConfirmedItem[]): string {
  const rows = items
    .map((it) => {
      const optionLines = (it.options ?? [])
        .map((o) => {
          const price = o.priceDelta > 0 ? ` (+${formatShekels(o.priceDelta)})` : "";
          return `<div style="font-size:12px;color:${BRAND.mute};">+ ${escape(o.name)}${price}</div>`;
        })
        .join("");
      const sizeLine = it.size
        ? `<div style="font-size:12px;color:${BRAND.mute};margin-top:2px;">${escape(it.size)}</div>`
        : "";
      const notesLine = it.notes
        ? `<div style="font-size:12px;color:#9a6500;margin-top:6px;">הערה: ${escape(it.notes)}</div>`
        : "";
      return `<tr>
        <td valign="top" dir="rtl" style="padding:10px 0;border-bottom:1px solid #f0e8d2;text-align:right;">
          <div style="font-size:14px;font-weight:700;color:${BRAND.ink};">${it.quantity}× ${escape(it.name)}</div>
          ${sizeLine}
          ${optionLines}
          ${notesLine}
        </td>
        <td valign="top" dir="ltr" style="padding:10px 0 10px 12px;border-bottom:1px solid #f0e8d2;font-size:14px;font-weight:700;color:${BRAND.ink};white-space:nowrap;text-align:left;">
          ${escape(formatShekels(it.totalPrice))}
        </td>
      </tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="border-collapse:collapse;margin:6px 0 0;">
    ${rows}
  </table>`;
}

function summaryRow(label: string, value: string, opts: { bold?: boolean; muted?: boolean } = {}): string {
  const weight = opts.bold ? "800" : "500";
  const color = opts.muted ? BRAND.mute : BRAND.ink2;
  const size = opts.bold ? "16px" : "14px";
  return `<tr>
    <td dir="rtl" style="padding:6px 0;font-size:${size};color:${color};font-weight:${weight};text-align:right;">${escape(label)}</td>
    <td dir="ltr" style="padding:6px 0 6px 12px;font-size:${size};color:${color};font-weight:${weight};text-align:left;">${escape(value)}</td>
  </tr>`;
}

export function orderConfirmedEmail({
  customerName,
  businessName,
  orderNumber,
  method,
  paymentMethod,
  items,
  subtotal,
  deliveryFee,
  serviceFee,
  cutleryFee,
  tip,
  discount,
  total,
  trackingUrl,
  addressLine,
  branchPhone,
  whatsappLink,
  scheduledForLabel,
  customerNotes,
}: {
  customerName: string;
  businessName: string;
  orderNumber: string;
  method: "delivery" | "pickup";
  paymentMethod: string;
  items: OrderConfirmedItem[];
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  cutleryFee: number;
  tip: number;
  discount: number;
  total: number;
  trackingUrl: string;
  addressLine?: string | null;
  branchPhone?: string | null;
  whatsappLink?: string | null;
  scheduledForLabel?: string | null;
  customerNotes?: string | null;
}) {
  const paymentLabels: Record<string, string> = {
    cash: "מזומן",
    card: "כרטיס אשראי",
    bit: "ביט",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
  };
  const paymentLabel = paymentLabels[paymentMethod] ?? paymentMethod;
  const methodLabel = method === "delivery" ? "משלוח" : "איסוף עצמי";

  const summaryRows: string[] = [summaryRow("פריטים", formatShekels(subtotal))];
  if (deliveryFee > 0) summaryRows.push(summaryRow("דמי משלוח", formatShekels(deliveryFee)));
  if (serviceFee > 0) summaryRows.push(summaryRow("דמי שירות", formatShekels(serviceFee)));
  if (cutleryFee > 0) summaryRows.push(summaryRow("סכו\"ם", formatShekels(cutleryFee)));
  if (tip > 0) summaryRows.push(summaryRow("טיפ לשליח", formatShekels(tip)));
  if (discount > 0) summaryRows.push(summaryRow("הנחה", `-${formatShekels(discount)}`, { muted: true }));
  summaryRows.push(summaryRow("סה\"כ לתשלום", formatShekels(total), { bold: true }));

  const summaryTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="border-collapse:collapse;border-top:2px solid ${BRAND.line};margin-top:14px;padding-top:6px;">
    ${summaryRows.join("")}
  </table>`;

  const metaTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="border-collapse:collapse;background:${BRAND.cream};border:1px solid #f0e8d2;border-radius:12px;padding:14px 16px;margin:0 0 18px;">
    <tr>
      <td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;">הזמנה</td>
      <td dir="ltr" style="font-size:13px;color:${BRAND.ink};font-weight:800;padding:3px 0 3px 12px;text-align:left;">${escape(orderNumber)}</td>
    </tr>
    <tr>
      <td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;">סוג</td>
      <td dir="rtl" style="font-size:13px;color:${BRAND.ink2};padding:3px 0 3px 12px;text-align:left;">${escape(methodLabel)}</td>
    </tr>
    <tr>
      <td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;">תשלום</td>
      <td dir="rtl" style="font-size:13px;color:${BRAND.ink2};padding:3px 0 3px 12px;text-align:left;">${escape(paymentLabel)}</td>
    </tr>
    ${
      scheduledForLabel
        ? `<tr><td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;">לאספקה</td><td dir="rtl" style="font-size:13px;color:${BRAND.ink2};padding:3px 0 3px 12px;text-align:left;">${escape(scheduledForLabel)}</td></tr>`
        : ""
    }
    ${
      addressLine
        ? `<tr><td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;vertical-align:top;">כתובת</td><td dir="rtl" style="font-size:13px;color:${BRAND.ink2};padding:3px 0 3px 12px;text-align:left;">${escape(addressLine)}</td></tr>`
        : ""
    }
    ${
      customerNotes
        ? `<tr><td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;vertical-align:top;">הערה</td><td dir="rtl" style="font-size:13px;color:#9a6500;padding:3px 0 3px 12px;text-align:left;">${escape(customerNotes)}</td></tr>`
        : ""
    }
    ${
      branchPhone
        ? `<tr><td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;">המסעדה</td><td dir="ltr" style="font-size:13px;color:${BRAND.ink2};padding:3px 0 3px 12px;text-align:left;"><a href="tel:${escape(branchPhone)}" style="color:${BRAND.ink2};text-decoration:none;">${escape(branchPhone)}</a></td></tr>`
        : ""
    }
  </table>`;

  const tail =
    metaTable +
    `<h3 style="margin:18px 0 4px;font-size:15px;font-weight:800;color:${BRAND.ink};text-align:right;">פירוט הזמנה</h3>` +
    itemsTable(items) +
    summaryTable;

  return renderRtlEmail({
    subject: `תודה על ההזמנה ב-${businessName} · ${orderNumber}`,
    preheader: `הזמנה ${orderNumber} התקבלה ב-${businessName}. סה"כ ${formatShekels(total)}.`,
    heading: `תודה ${customerName}!`,
    paragraphs: [
      `קיבלנו את ההזמנה שלך ב-<strong>${escape(businessName)}</strong> והיא בדרך לרשת.`,
      `שמרנו לך פירוט מלא כאן וגם בקישור המעקב. אם תרצה לשנות משהו - צור קשר עם המסעדה.`,
    ],
    raw: true,
    button: { href: trackingUrl, label: "צפייה במעקב ההזמנה" },
    tail,
    whatsappButton: whatsappLink ? { href: whatsappLink, label: "צ'אט בוואטסאפ" } : undefined,
    brand: businessName,
    footerNote: `נשלח בשם ${businessName}.`,
  });
}

export function orderCancelledEmail({
  customerName,
  businessName,
  orderNumber,
  total,
  paymentMethod,
  reason,
  branchPhone,
  whatsappLink,
}: {
  customerName: string;
  businessName: string;
  orderNumber: string;
  total: number;
  paymentMethod: string;
  reason?: string | null;
  branchPhone?: string | null;
  whatsappLink?: string | null;
}) {
  const paymentLabels: Record<string, string> = {
    cash: "מזומן",
    card: "כרטיס אשראי",
    bit: "ביט",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
  };
  const paymentLabel = paymentLabels[paymentMethod] ?? paymentMethod;
  const refundLine =
    paymentMethod === "cash"
      ? "התשלום הוא במזומן ולכן לא בוצע חיוב בפועל."
      : "אם בוצע חיוב, ההחזר יזוכה אוטומטית לאמצעי התשלום תוך מספר ימי עסקים. אם לא מופיע אצלך זיכוי תוך 7 ימי עסקים, צרו קשר עם המסעדה.";

  const reasonBlock = reason
    ? `<p dir="rtl" style="margin:0 0 14px;line-height:1.65;color:${BRAND.ink2};font-size:15px;direction:rtl;text-align:right;background:${BRAND.cream};border:1px solid #f0e8d2;border-radius:12px;padding:12px 14px;"><strong>סיבת הביטול:</strong><br/>${escape(reason)}</p>`
    : "";

  const contactTable = branchPhone
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="border-collapse:collapse;background:${BRAND.cream};border:1px solid #f0e8d2;border-radius:12px;padding:14px 16px;margin:6px 0 0;">
        <tr>
          <td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;">הזמנה</td>
          <td dir="ltr" style="font-size:13px;color:${BRAND.ink};font-weight:800;padding:3px 0 3px 12px;text-align:left;">${escape(orderNumber)}</td>
        </tr>
        <tr>
          <td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;">סכום</td>
          <td dir="ltr" style="font-size:13px;color:${BRAND.ink2};padding:3px 0 3px 12px;text-align:left;">${escape(formatShekels(total))}</td>
        </tr>
        <tr>
          <td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;">תשלום</td>
          <td dir="rtl" style="font-size:13px;color:${BRAND.ink2};padding:3px 0 3px 12px;text-align:left;">${escape(paymentLabel)}</td>
        </tr>
        <tr>
          <td dir="rtl" style="font-size:13px;color:${BRAND.mute};padding:3px 0;">המסעדה</td>
          <td dir="ltr" style="font-size:13px;color:${BRAND.ink2};padding:3px 0 3px 12px;text-align:left;"><a href="tel:${escape(branchPhone)}" style="color:${BRAND.ink2};text-decoration:none;">${escape(branchPhone)}</a></td>
        </tr>
      </table>`
    : "";

  return renderRtlEmail({
    subject: `הזמנה ${orderNumber} בוטלה · ${businessName}`,
    preheader: `המסעדה ${businessName} ביטלה את הזמנה ${orderNumber}.`,
    heading: `שלום ${customerName}, ההזמנה בוטלה`,
    paragraphs: [
      `המסעדה <strong>${escape(businessName)}</strong> ביטלה את הזמנה <strong>${escape(orderNumber)}</strong>.`,
      refundLine,
      reasonBlock,
      contactTable,
    ].filter(Boolean),
    raw: true,
    whatsappButton: whatsappLink ? { href: whatsappLink, label: "צ'אט עם המסעדה" } : undefined,
    brand: businessName,
    footerNote: `נשלח בשם ${businessName}.`,
  });
}
