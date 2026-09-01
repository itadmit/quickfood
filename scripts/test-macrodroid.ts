/**
 * Fires one welcome-shaped message at the MacroDroid webhook.
 *   npx tsx --env-file=.env.local scripts/test-macrodroid.ts 0501234567
 */
async function main() {
  const phone = process.argv[2];
  if (!phone) {
    console.error("usage: npx tsx scripts/test-macrodroid.ts <05XXXXXXXX>");
    process.exit(1);
  }
  const { sendViaMacroDroid, isMacroDroidConfigured } = await import("../lib/whatsapp/macrodroid");
  if (!isMacroDroidConfigured()) {
    console.error("MACRODROID_WEBHOOK_URL is not set in .env.local");
    process.exit(1);
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
