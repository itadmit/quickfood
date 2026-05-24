import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsTabs } from "../SettingsTabs";
import { WoltImportClient } from "./WoltImportClient";
import { AppearanceToggle } from "./AppearanceToggle";

export const dynamic = "force-dynamic";

export default async function AdvancedSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [lastImport, tenant] = await Promise.all([
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
      select: { dashboardVersion: true },
    }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">פעולות מתקדמות לחנות שלך</p>
      </header>
      <SettingsTabs />

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-6 max-w-3xl">
        <header className="mb-4">
          <h2 className="text-lg font-bold">ניראות הדשבורד</h2>
          <p className="text-sm text-qf-mute mt-1 leading-relaxed">
            בחרו את העיצוב של מסכי הניהול. ברירת המחדל — הניראות החדשה
            (צהוב/שחור, בסגנון אתר הבית). אפשר לחזור בכל רגע לניראות
            הקלאסית.
          </p>
        </header>
        <AppearanceToggle
          initial={(tenant?.dashboardVersion ?? "v2") as "v1" | "v2"}
        />
      </section>

      <section className="bg-white rounded-2xl border border-qf-line-dash p-4 lg:p-6 max-w-3xl">
        <header className="mb-4">
          <h2 className="text-lg font-bold">ייבוא תפריט מוולט</h2>
          <p className="text-sm text-qf-mute mt-1 leading-relaxed">
            מדביקים את כתובת החנות שלכם בוולט, ואנחנו מייבאים אוטומטית את כל
            הקטגוריות, הפריטים, התמונות והתוספות לתפריט של QuickFood. החיסכון
            בזמן הקמה — שעות.
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
        />
      </section>
    </div>
  );
}
