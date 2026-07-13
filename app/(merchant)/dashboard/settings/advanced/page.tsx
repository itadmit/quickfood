import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { WoltImportClient } from "./WoltImportClient";
import { AppearanceToggle } from "./AppearanceToggle";
import { InstallAppButton } from "./InstallAppButton";
import { DeleteAllItems } from "./DeleteAllItems";
import { ResetStore } from "./ResetStore";

export const dynamic = "force-dynamic";

export default async function AdvancedSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const params = await searchParams;
  const woltParam = typeof params.wolt === "string" ? params.wolt : undefined;
  const ackParam = params.ack === "1";
  const autoStartParam = params.autostart === "1";

  const [lastImport, tenant, itemCount] = await Promise.all([
    prisma.woltImport.findFirst({
      where: { tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        sourceUrl: true,
        venueName: true,
        status: true,
        categoriesImported: true,
        itemsImported: true,
        imagesUploaded: true,
        createdAt: true,
        committedAt: true,
      },
    }),
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { dashboardVersion: true, name: true },
    }),
    prisma.menuItem.count({ where: { tenantId: session.tenantId } }),
  ]);

  const isOwner = session.role === "owner";

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="פעולות מתקדמות לחנות שלך" />

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-6">
        <header className="mb-4">
          <h2 className="text-lg font-bold">ניראות הדשבורד</h2>
          <p className="text-sm text-qf-mute mt-1 leading-relaxed">
            בחרו את העיצוב של מסכי הניהול. ברירת המחדל - הניראות החדשה
            (צהוב/שחור, בסגנון אתר הבית). אפשר לחזור בכל רגע לניראות
            הקלאסית.
          </p>
        </header>
        <AppearanceToggle
          initial={(tenant?.dashboardVersion ?? "v2") as "v1" | "v2"}
        />
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-6">
        <header className="mb-4">
          <h2 className="text-lg font-bold">התקנת האפליקציה</h2>
          <p className="text-sm text-qf-mute mt-1 leading-relaxed">
            שמרו את הדשבורד כאפליקציה במסך הבית - אייקון QuickFood, פתיחה
            במסך מלא בלי דפדפן, והתראות על הזמנות חדשות.
          </p>
        </header>
        <InstallAppButton />
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-6">
        <header className="mb-4">
          <h2 className="text-lg font-bold">ייבוא תפריט מוולט</h2>
          <p className="text-sm text-qf-mute mt-1 leading-relaxed">
            מדביקים את כתובת החנות שלכם בוולט, ואנחנו מייבאים אוטומטית את כל
            הקטגוריות, הפריטים, התמונות והתוספות לתפריט של QuickFood. החיסכון
            בזמן הקמה - שעות.
          </p>
        </header>
        <WoltImportClient
          lastImport={
            lastImport
              ? {
                  ...lastImport,
                  createdAt: lastImport.createdAt.toISOString(),
                  committedAt: lastImport.committedAt?.toISOString() ?? null,
                }
              : null
          }
          initialUrl={woltParam}
          initialAck={ackParam}
          autoStart={autoStartParam}
        />
      </section>

      {isOwner && (
        <section className="bg-white rounded-2xl border border-qf-tomato/30 p-4 lg:p-6">
          <header className="mb-4">
            <h2 className="text-lg font-bold text-qf-tomato">איזור מסוכן</h2>
            <p className="text-sm text-qf-mute mt-1 leading-relaxed">
              מחיקת כל המוצרים שבתפריט בלחיצה אחת. שימושי כשרוצים להתחיל
              מחדש אחרי ייבוא שגוי מוולט.
            </p>
          </header>
          <DeleteAllItems itemCount={itemCount} />
        </section>
      )}

      {isOwner && tenant?.name && (
        <section className="bg-white rounded-2xl border border-qf-tomato/30 p-4 lg:p-6">
          <header className="mb-4">
            <h2 className="text-lg font-bold text-qf-tomato">
              איפוס מוחלט של החנות
            </h2>
            <p className="text-sm text-qf-mute mt-1 leading-relaxed">
              מאפס את החנות לחלוטין: תפריט, קטגוריות, תוספות, שיווק
              (קופונים/קמפיינים), ביקורות, שליחים, אזורי משלוח,
              webhooks, לוגו, cover, סוג עסק, ערכת צבעים. חוזרים למסך
              ברוך-הבא - ממש כאילו החנות נפתחה מחדש. הזמנות, לקוחות,
              חברי צוות, יתרת SMS ופרטי חיוב נשמרים. דורש להקליד את
              שם החנות לאישור.
            </p>
          </header>
          <ResetStore tenantName={tenant.name} />
        </section>
      )}
    </div>
  );
}
