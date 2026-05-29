/**
 * One-shot preview: sends every email type QuickFood produces to a recipient
 * via the real Resend pipeline, so they can be reviewed visually.
 *
 *   $ npx tsx --env-file=.env.local scripts/send-verify-preview.ts <recipient@example.com>
 *
 * Sends 6 emails (subjects prefixed with [PREVIEW N/6] for easy ordering):
 *   1. welcome             — after merchant signup
 *   2. verify              — email verification
 *   3. password reset      — forgot password flow
 *   4. test                — system test (Resend health check)
 *   5. review reminder     — sent to customer after delivered order (plain text)
 *   6. lead notification   — sent to admin on landing-page lead (custom HTML)
 */
import { sendEmail } from "../lib/email/send";
import {
  welcomeEmail,
  passwordResetEmail,
  verifyEmailEmail,
  testEmail,
  reviewReminderEmail,
  leadEmail,
} from "../lib/email/templates";

async function main() {
  const to = process.argv[2] ?? "itadmit@gmail.com";
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
  const businessName = "פיצה דמו";
  const ownerName = "איתי";

  const sends: Array<{
    label: string;
    subject: string;
    body: string;
    html?: string;
    kind: string;
  }> = [];

  // 1. welcome
  {
    const r = welcomeEmail({
      ownerName,
      businessName,
      dashboardUrl: `${base}/m`,
    });
    sends.push({
      label: "welcome",
      subject: `[PREVIEW 1/6] ברוכים הבאים ל-QuickFood, ${businessName}!`,
      body: r.text,
      html: r.html,
      kind: "preview_welcome",
    });
  }

  // 2. verify
  {
    const r = verifyEmailEmail({
      ownerName,
      businessName,
      verifyUrl: `${base}/api/v1/auth/verify-email/preview-token-not-real`,
      expiresInHours: 24,
    });
    sends.push({
      label: "verify",
      subject: `[PREVIEW 2/6] הפעלת החנות ${businessName} ב-QuickFood`,
      body: r.text,
      html: r.html,
      kind: "preview_verify",
    });
  }

  // 3. password reset
  {
    const r = passwordResetEmail({
      ownerName,
      resetUrl: `${base}/m/reset-password?token=preview-token-not-real`,
      expiresInMinutes: 30,
    });
    sends.push({
      label: "password reset",
      subject: "[PREVIEW 3/6] איפוס סיסמה ל-QuickFood",
      body: r.text,
      html: r.html,
      kind: "preview_password_reset",
    });
  }

  // 4. test
  {
    const r = testEmail({ recipient: to });
    sends.push({
      label: "test",
      subject: "[PREVIEW 4/6] QuickFood — בדיקת מייל",
      body: r.text,
      html: r.html,
      kind: "preview_test",
    });
  }

  // 5. review reminder — same branded template as the rest
  {
    const r = reviewReminderEmail({
      hello: `שלום ${ownerName}`,
      businessName,
      reviewUrl: `${base}/s/pizza-demo/orders/preview-order#review`,
    });
    sends.push({
      label: "review reminder",
      subject: `[PREVIEW 5/6] איך הייתה ההזמנה מ-${businessName}?`,
      body: r.text,
      html: r.html,
      kind: "preview_review_reminder",
    });
  }

  // 6. lead notification — same branded template, sent to admin inbox
  {
    const r = leadEmail({
      name: "ישראל ישראלי",
      restaurant: "מסעדת דוגמה",
      email: "demo@example.com",
      phone: "050-1234567",
      message: "שלום, אשמח לקבל הדגמה של המערכת.",
      source: "landing_hero",
      ip: "127.0.0.1",
    });
    sends.push({
      label: "lead notification",
      subject: `[PREVIEW 6/6] ליד חדש: ישראל ישראלי · מסעדת דוגמה`,
      body: r.text,
      html: r.html,
      kind: "preview_lead",
    });
  }

  for (const s of sends) {
    console.log(`[preview] sending "${s.label}" to ${to} …`);
    const result = await sendEmail({
      tenantId: null,
      to,
      subject: s.subject,
      body: s.body,
      html: s.html,
      kind: s.kind,
    });
    console.log(`  → ${result.status} (${result.providerId ?? result.providerMsg ?? "-"})`);
    if (result.status !== "sent") process.exitCode = 1;
    // small spacing so Resend sees them as distinct sends
    await new Promise((r) => setTimeout(r, 400));
  }
}

main().catch((err) => {
  console.error("[preview] threw:", err);
  process.exit(1);
});
