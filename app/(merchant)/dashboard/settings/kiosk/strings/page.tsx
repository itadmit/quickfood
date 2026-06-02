import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../../SettingsHeader";
import {
  KIOSK_DEFAULTS_HE,
  normalizeKioskOverrides,
} from "@/lib/i18n/kiosk-messages";
import { KioskStringsForm } from "./KioskStringsForm";

export const dynamic = "force-dynamic";

// Flatten the defaults tree to a sorted [section, key, defaultValue] list
// so the form can group + render them in stable order.
function flattenDefaults(): Array<{
  section: string;
  key: string;
  defaultValue: string;
}> {
  const out: Array<{ section: string; key: string; defaultValue: string }> = [];
  for (const [section, group] of Object.entries(KIOSK_DEFAULTS_HE)) {
    if (typeof group !== "object" || group == null) continue;
    for (const [name, value] of Object.entries(
      group as Record<string, string>,
    )) {
      if (typeof value !== "string") continue;
      out.push({
        section,
        key: `${section}.${name}`,
        defaultValue: value,
      });
    }
  }
  return out;
}

// Human-readable section labels for the form. Keys not present here fall
// back to a Title-Cased version of the section name.
const SECTION_LABELS: Record<string, string> = {
  start: "מסך פתיחה",
  mode: "בחירת ישיבה / לקיחה",
  phoneEntry: "הזנת טלפון",
  otp: "אימות OTP",
  nameEntry: "הזנת שם",
  payChoice: "בחירת אמצעי תשלום",
  payQr: "מסך QR לתשלום",
  thanks: "מסך תודה",
  header: "כותרת + כפתורים משותפים",
  featured: "תווית מומלץ",
  browse: "תפריט וחיפוש",
  cart: "סל קניות",
  bundle: "מבצעי באנדל",
  upsell: "המלצות בסל",
  checkoutUpsell: "המלצה לפני תשלום",
  help: "מסך עזרה",
  diningNote: 'הערה למטבח ("קיוסק · לשבת")',
  errors: "הודעות שגיאה",
  payPage: "מסך התשלום בטלפון",
  placing: "מצב שליחת ההזמנה",
  picker: "מסך פריט",
};

export default async function KioskStringsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      kioskEnabled: true,
      kioskStringOverrides: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  const overrides = normalizeKioskOverrides(tenant.kioskStringOverrides);
  const defaults = flattenDefaults();

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="טקסטים מותאמים לקיוסק" />
      {!tenant.kioskEnabled ? (
        <div className="bg-white border-2 border-dashed border-qf-line-dash rounded-2xl p-8 text-center space-y-3">
          <h2 className="text-lg font-bold">
            צריך להפעיל את הקיוסק לפני שמתאימים טקסטים
          </h2>
          <p className="text-sm text-qf-mute leading-relaxed max-w-xl mx-auto">
            רק כשהקיוסק פעיל תוכלי לראות איך השינויים נראים על הטאבלט.
            פני אלינו ב-WhatsApp כדי להפעיל.
          </p>
        </div>
      ) : (
        <KioskStringsForm
          defaults={defaults}
          overrides={overrides}
          sectionLabels={SECTION_LABELS}
        />
      )}
    </div>
  );
}
