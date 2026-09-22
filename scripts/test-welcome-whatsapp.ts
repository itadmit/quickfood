/**
 * Fires the real signup welcome at a number, through the real code path.
 *
 *   npx tsx --env-file=.env.local scripts/test-welcome-whatsapp.ts 0501234567
 *
 * Replaces the old test-macrodroid.ts. That script drove an Android phone
 * relaying into the WhatsApp app; this one drives Quick Chat's Cloud API.
 *
 * NOTE: a template send is billable and real. The tenantId below is fixed, so
 * Quick Chat's idempotency key dedupes repeat runs against the same number -
 * rerunning costs nothing and sends nothing. Pass a second argument to vary
 * it when you genuinely want another send.
 */
async function main() {
  const phone = process.argv[2];
  const tenantId = process.argv[3] ?? "test-tenant";
  if (!phone) {
    console.error(
      "usage: npx tsx --env-file=.env.local scripts/test-welcome-whatsapp.ts <05XXXXXXXX> [tenantId]",
    );
    process.exit(1);
  }

  const { isQuickChatConfigured } = await import("../lib/whatsapp/quickchat");
  if (!isQuickChatConfigured()) {
    console.error("QUICKCHAT_API_KEY is not set — the send would fall through to iBot.");
    process.exit(1);
  }

  const { sendWelcomeWhatsApp } = await import("../lib/auth/send-welcome-whatsapp");
  const sent = await sendWelcomeWhatsApp({
    phone,
    ownerName: "יוגב",
    businessName: "פיצה בדיקה",
    dashboardUrl: "https://quickfood.co.il/dashboard",
    storeUrl: "https://quickfood.co.il/s/test-pizza",
    tenantId,
  });
  console.log({ sent });
  process.exit(sent ? 0 : 1);
}

main();
