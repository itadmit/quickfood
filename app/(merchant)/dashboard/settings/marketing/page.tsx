import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { MarketingForm } from "./MarketingForm";

export const dynamic = "force-dynamic";

export default async function MarketingSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { facebookPixelId: true },
  });

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="פיקסל פייסבוק ומעקב המרות על החנות שלך" />
      <MarketingForm facebookPixelId={tenant?.facebookPixelId ?? ""} />
    </div>
  );
}
