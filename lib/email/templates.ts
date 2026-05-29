/**
 * RTL-first Hebrew email templates.
 *
 * Every QuickFood email goes through `renderRtlEmail` so the root `<html>`,
 * `<body>`, and wrapper `<div>` all carry `dir="rtl"` and `lang="he"`. Gmail
 * and most clients strip <head> styles, so we inline everything important and
 * also set inline `text-align: right` / `direction: rtl` on the containers.
 */

// Brand palette mirrors the V2 dashboard: bold yellow surface + cream
// card + black ink/borders. Email-safe — no gradients, no box-shadows,
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

// Public origin used for email-embedded assets — must be reachable from the
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
  /** Email subject — repeated in the preheader for some clients. */
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
  /** If true, treat paragraphs as raw HTML (caller is responsible for escaping). */
  raw?: boolean;
  /** Optional raw HTML rendered between the primary button and the footer note —
   *  used for secondary CTAs like the WhatsApp support button. Caller is
   *  responsible for escaping any dynamic values. */
  tail?: string;
  /** Optional secondary WhatsApp button (green pill, white icon). Rendered
   *  inside `tail` slot if `tail` is not provided directly. */
  whatsappButton?: { href: string; label: string };
}

export function renderRtlEmail(opts: RtlEmailOptions): { html: string; text: string } {
  const paragraphs = opts.paragraphs
    .map((p) => `<p dir="rtl" style="margin:0 0 14px;line-height:1.65;color:${BRAND.ink2};font-size:15px;direction:rtl;text-align:right;">${opts.raw ? p : escape(p)}</p>`)
    .join("");

  // Black-on-yellow chunky button — matches the dashboard's V2 brand
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

  // Secondary WhatsApp CTA — green pill with white WhatsApp glyph + label,
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
            <div style="font-size:12px;font-weight:900;color:${BRAND.ink};letter-spacing:1.5px;text-transform:uppercase;">QuickFood</div>
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
              מייל זה נשלח אוטומטית מ-QuickFood. אין להשיב למייל זה.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  // Plaintext fallback — same content, no HTML.
  const textParts: string[] = [opts.heading, "", ...opts.paragraphs];
  if (opts.button) textParts.push("", `${opts.button.label}: ${opts.button.href}`);
  if (opts.whatsappButton) {
    textParts.push("", `${opts.whatsappButton.label}: ${opts.whatsappButton.href}`);
  }
  if (opts.footerNote) textParts.push("", opts.footerNote);
  textParts.push("", "—", "QuickFood");
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
