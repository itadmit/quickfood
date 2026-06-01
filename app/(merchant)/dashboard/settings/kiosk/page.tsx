import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { KioskSettingsForm } from "./KioskSettingsForm";

export const dynamic = "force-dynamic";

export default async function KioskSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      slug: true,
      name: true,
      kioskEnabled: true,
      kioskWelcomeText: true,
      kioskIdleSeconds: true,
      kioskRequirePhone: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="קיוסק להזמנה עצמית" />
      <KioskSettingsForm
        slug={tenant.slug}
        enabled={tenant.kioskEnabled}
        initial={{
          welcomeText: tenant.kioskWelcomeText ?? "",
          idleSeconds: tenant.kioskIdleSeconds,
          requirePhone: tenant.kioskRequirePhone,
        }}
      />
    </div>
  );
}
