import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsTabs } from "../SettingsTabs";
import { HoursForm } from "./HoursForm";

export const dynamic = "force-dynamic";

export default async function HoursSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const branch = await prisma.branch.findFirst({
    where: { tenantId: session.tenantId, isPrimary: true },
  });
  if (!branch) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">שעות פעילות · {branch.name}</p>
      </header>
      <SettingsTabs />
      <HoursForm branchId={branch.id} initialHours={(branch.hours as Record<string, DayHours>) ?? {}} />
    </div>
  );
}

export type DayHours = { open: string; close: string; active: boolean };
