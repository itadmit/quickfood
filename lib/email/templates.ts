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
  card: "#FFFBEC",
  ink: "#000000",
  ink2: "#1a1a1a",
  mute: "#5a5a5a",
  line: "#000000",
  buttonBg: "#000000",
  buttonText: "#F8CB1E",
};

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

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(opts.subject)}</title>
</head>
<body dir="rtl" style="margin:0;padding:0;background:${BRAND.cream};font-family:'Segoe UI',Tahoma,Arial,'Helvetica Neue',Helvetica,sans-serif;color:${BRAND.ink};direction:rtl;text-align:right;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="background:${BRAND.cream};padding:28px 12px;direction:rtl;">
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
          <td bgcolor="${BRAND.card}" style="background-color:${BRAND.card};padding:28px;direction:rtl;text-align:right;">
            ${paragraphs}
            ${button}
            ${footerNote}
          </td>
        </tr>
        <tr>
          <td bgcolor="${BRAND.card}" style="background-color:${BRAND.card};padding:18px 28px;border-top:2px solid ${BRAND.line};direction:rtl;text-align:right;">
            <div style="font-size:12px;color:${BRAND.mute};line-height:1.5;">
              קיבלת את המייל הזה מ-QuickFood. אם זה לא רלוונטי, אפשר פשוט להתעלם.
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
  if (opts.footerNote) textParts.push("", opts.footerNote);
  textParts.push("", "—", "QuickFood");
  const text = textParts.join("\n");

  return { html, text };
}

export function welcomeEmail({
  ownerName,
  businessName,
  dashboardUrl,
}: {
  ownerName: string;
  businessName: string;
  dashboardUrl: string;
}) {
  return renderRtlEmail({
    subject: `ברוכים הבאים ל-QuickFood, ${businessName}!`,
    preheader: "החנות שלך מוכנה. הצעדים הראשונים מחכים בדשבורד.",
    heading: `שלום ${ownerName}, ברוכים הבאים!`,
    paragraphs: [
      `החנות של ${businessName} נוצרה בהצלחה ב-QuickFood.`,
      "התחלת תקופת ניסיון של 7 ימים — בלי כרטיס אשראי, גישה מלאה לכל הפיצ׳רים.",
      "צעדים מומלצים ראשונים: הוסיפו תפריט, הגדירו שעות פעילות, וצרו קישור לחנות לשתף עם הלקוחות.",
    ],
    button: { href: dashboardUrl, label: "כניסה לדשבורד" },
    footerNote: "אם יש שאלה — אפשר להשיב למייל הזה ונחזור אליך.",
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
      "לא ביקשת לאפס סיסמה? אפשר להתעלם מהמייל — הסיסמה הקיימת נשארת בתוקף.",
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
    paragraphs: [
      `החנות של ${businessName} נוצרה ב-QuickFood, אבל לפני שתופיע כפעילה לקוחות צריך לאמת שהמייל הזה באמת שלך.`,
      "לחיצה על הכפתור שמתחת מאמתת את הכתובת ומסירה את ההתראה מהדשבורד — לוקח שנייה.",
      `הקישור תקף ל-${expiresInHours} שעות. אם פג תוקף, אפשר לבקש קישור חדש מהבאנר שבראש הדשבורד.`,
    ],
    button: { href: verifyUrl, label: "הפעל את החנות" },
    footerNote:
      "לא הירשמת ל-QuickFood? אפשר להתעלם מהמייל הזה — בלי אימות החשבון יישאר מסומן ולא יבוצעו בו פעולות בשמך.",
  });
}

export function testEmail({ recipient }: { recipient: string }) {
  return renderRtlEmail({
    subject: "QuickFood — בדיקת מייל",
    preheader: "אם קיבלת את זה, Resend מחובר נכון.",
    heading: "הצלחה! המייל הגיע.",
    paragraphs: [
      `שלחנו את המייל הזה אל ${recipient} כדי לאמת שההגדרות של Resend ושל הדומיין quickfood.co.il עובדות כמו שצריך.`,
      "אפשר להתעלם מהמייל — שום פעולה לא דרושה.",
    ],
    footerNote: "סטטוס: מערכת המיילים פעילה.",
  });
}
