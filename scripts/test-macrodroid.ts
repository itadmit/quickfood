/**
 * Fires a message at the MacroDroid webhook.
 *
 *   npx tsx --env-file=.env.local scripts/test-macrodroid.ts 0501234567
 *   npx tsx --env-file=.env.local scripts/test-macrodroid.ts 0501234567 --welcome
 *
 * --welcome runs the real signup path (sendWelcomeWhatsApp), so it exercises
 * the full-length Hebrew body and the iBot fallback exactly as production does.
 */
async function main() {
  const phone = process.argv[2];
  const welcome = process.argv.includes("--welcome");
  if (!phone) {
    console.error("usage: npx tsx scripts/test-macrodroid.ts <05XXXXXXXX> [--welcome]");
    process.exit(1);
  }
  const { isMacroDroidConfigured, sendViaMacroDroid } = await import("../lib/whatsapp/macrodroid");
  if (!isMacroDroidConfigured()) {
    console.error("MACRODROID_WEBHOOK_URL is not set in .env.local");
    process.exit(1);
  }

  if (welcome) {
    const { sendWelcomeWhatsApp } = await import("../lib/auth/send-welcome-whatsapp");
    const sent = await sendWelcomeWhatsApp({
      phone,
      ownerName: "יוגב",
      businessName: "פיצה בדיקה",
      dashboardUrl: "https://quickfood.co.il/dashboard",
      storeUrl: "https://quickfood.co.il/s/test-pizza",
    });
    console.log({ sent });
    process.exit(sent ? 0 : 1);
  }

  const res = await sendViaMacroDroid({
    phone,
    message: "בדיקה מ-QuickFood: ההודעה הזאת נשלחה מהמכשיר דרך MacroDroid.",
    vars: { name: "יוגב", business: "פיצה בדיקה" },
  });
  console.log(res);
  process.exit(res.ok ? 0 : 1);
}

main();
