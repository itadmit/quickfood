/**
 * RTL-first Hebrew email templates.
 *
 * Every QuickFood email goes through `renderRtlEmail` so the root `<html>`,
 * `<body>`, and wrapper `<div>` all carry `dir="rtl"` and `lang="he"`. Gmail
 * and most clients strip <head> styles, so we inline everything important and
 * also set inline `text-align: right` / `direction: rtl` on the containers.
 */

const BRAND = {
  primary: "#2f7a3e",
  deep: "#1f5a2a",
  bg: "#f5f1e6",
  card: "#ffffff",
  ink: "#1a1f1d",
  ink2: "#3a4a40",
  mute: "#7c8a82",
  line: "#e1ddd1",
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
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6;color:${BRAND.ink2};font-size:15px;">${opts.raw ? p : escape(p)}</p>`)
    .join("");

  const button = opts.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
        <tr>
          <td align="center" bgcolor="${BRAND.primary}" style="border-radius:12px;">
            <a href="${escape(opts.button.href)}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 28px;font-family:inherit;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
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
    ? `<p style="margin:18px 0 0;font-size:12px;color:${BRAND.mute};line-height:1.5;">${escape(opts.footerNote)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(opts.subject)}</title>
</head>
<body dir="rtl" style="margin:0;padding:0;background:${BRAND.bg};font-family:'Segoe UI',Tahoma,Arial,'Helvetica Neue',Helvetica,sans-serif;color:${BRAND.ink};direction:rtl;text-align:right;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="background:${BRAND.bg};padding:24px 12px;direction:rtl;">
  <tr>
    <td align="center" dir="rtl">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" dir="rtl" style="max-width:560px;width:100%;background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:20px;overflow:hidden;direction:rtl;text-align:right;">
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.deep});padding:22px 28px;text-align:right;direction:rtl;">
            <div style="font-size:13px;font-weight:600;color:#ffffff;opacity:.85;letter-spacing:.5px;">QuickFood</div>
            <div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:6px;">${escape(opts.heading)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;direction:rtl;text-align:right;">
            ${paragraphs}
            ${button}
            ${footerNote}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 28px;background:${BRAND.bg};border-top:1px solid ${BRAND.line};direction:rtl;text-align:right;">
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
