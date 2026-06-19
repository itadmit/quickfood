import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { NotificationsSettingsForm } from "./NotificationsSettingsForm";

export const dynamic = "force-dynamic";

export default async function NotificationsSettingsPage() {
  const session = await getSession();
  if (session?.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [tenant, platform] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        notifyChannel: true,
        smsCreditsRemaining: true,
        whatsappToken: true,
        whatsappInstanceId: true,
        reviewsWhatsappSubscriptionId: true,
      },
    }),
    prisma.platformSettings.findFirst({
      select: { whatsappDefaultToken: true, whatsappDefaultInstanceId: true },
    }),
  ]);
  if (!tenant) redirect("/dashboard/login");

  const credits = tenant.smsCreditsRemaining > 0;
  const whatsappConnected =
    !!(tenant.whatsappToken && tenant.whatsappInstanceId) ||
    !!(platform?.whatsappDefaultToken && platform?.whatsappDefaultInstanceId);

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="איך מעדכנים את הלקוח על סטטוס ההזמנה - בנוסף למייל" />
      <NotificationsSettingsForm
        initial={{ channel: tenant.notifyChannel }}
        smsAvailable={credits}
        whatsappAvailable={whatsappConnected && credits}
        whatsappConnected={whatsappConnected}
        smsCreditsRemaining={tenant.smsCreditsRemaining}
        managedActive={!!tenant.reviewsWhatsappSubscriptionId}
      />
    </div>
  );
}
