import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { WhatsappSettingsForm } from "./WhatsappSettingsForm";

export const dynamic = "force-dynamic";

export default async function WhatsappSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      whatsappToken: true,
      whatsappInstanceId: true,
      smsCreditsRemaining: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="חיבור WhatsApp (iBot Chat)" />
      <WhatsappSettingsForm
        initial={{
          token: tenant.whatsappToken ?? "",
          instanceId: tenant.whatsappInstanceId ?? "",
        }}
        creditsRemaining={tenant.smsCreditsRemaining}
      />
    </div>
  );
}
