import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { BrandingForm } from "./BrandingForm";
import { SettingsHeader } from "../SettingsHeader";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { id: true, name: true, logoLetter: true, logoUrl: true, themeId: true, businessType: true, cuisineType: true, about: true, slug: true, coverImage: true },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="מיתוג, צבעים ותצוגת החנות שלך" />
      <BrandingForm tenant={tenant} />
    </div>
  );
}
