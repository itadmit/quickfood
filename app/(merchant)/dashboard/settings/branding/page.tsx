import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { BrandingForm } from "./BrandingForm";
import { SettingsTabs } from "../SettingsTabs";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { id: true, name: true, logoLetter: true, logoUrl: true, themeId: true, businessType: true, cuisineType: true, slug: true, coverImage: true },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">ניהול הגדרות העסק והאפליקציה</p>
      </header>
      <SettingsTabs />
      <BrandingForm tenant={tenant} />
    </div>
  );
}
