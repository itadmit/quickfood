import { prisma } from "@/lib/db/client";
import { PlatformSettingsForm } from "./PlatformSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  // Lazily seed the singleton row if a fresh DB skipped the migration's
  // INSERT (e.g. preview branches that snapshot prod data).
  const settings = await prisma.platformSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות פלטפורמה</h1>
        <p className="text-sm text-qf-mute">
          ערכים גלובליים שמשמשים כברירת מחדל אם המסעדה לא הגדירה לעצמה.
        </p>
      </header>
      <PlatformSettingsForm
        initial={{
          whatsappDefaultToken: settings.whatsappDefaultToken ?? "",
          whatsappDefaultInstanceId: settings.whatsappDefaultInstanceId ?? "",
        }}
      />
    </div>
  );
}
