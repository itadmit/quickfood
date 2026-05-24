import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsTabs } from "../SettingsTabs";
import { WoltImportClient } from "./WoltImportClient";

export const dynamic = "force-dynamic";

export default async function AdvancedSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  // Most recent Wolt import for this tenant — gives the UI a starting
  // state ("you imported X 3 days ago — re-import?") instead of always
  // booting cold.
  const lastImport = await prisma.woltImport.findFirst({
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
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">פעולות מתקדמות לחנות שלך</p>
      </header>
      <SettingsTabs />

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
