import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { LanguagesForm } from "./LanguagesForm";
import { ManualTranslations } from "./ManualTranslations";

export const dynamic = "force-dynamic";

export default async function LanguagesSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { storefrontLanguages: true },
  });

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="שפות שהחנות מציעה ללקוחות" />
      <LanguagesForm enabled={tenant?.storefrontLanguages ?? ["he"]} />
      <ManualTranslations enabled={tenant?.storefrontLanguages ?? ["he"]} />
    </div>
  );
}
