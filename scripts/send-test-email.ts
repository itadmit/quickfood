/**
 * One-shot script to verify Resend + RTL templates.
 *
 *   $ npx tsx scripts/send-test-email.ts <recipient@example.com>
 *
 * Sends the RTL test template via the real lib/email/send pipeline so the
 * EmailLog row + template rendering get exercised end-to-end.
 */
import { sendEmail } from "../lib/email/send";
import { testEmail } from "../lib/email/templates";

async function main() {
  const to = process.argv[2] ?? "itadmit@gmail.com";
  console.log(`[test] sending RTL test email to ${to} …`);

  const { html, text } = testEmail({ recipient: to });
  const result = await sendEmail({
    tenantId: null,
    to,
    subject: "QuickFood - בדיקת מייל",
    body: text,
    html,
    kind: "system_test",
  });

  console.log("[test] result:", result);
  if (result.status !== "sent") {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[test] threw:", err);
  process.exit(1);
});
