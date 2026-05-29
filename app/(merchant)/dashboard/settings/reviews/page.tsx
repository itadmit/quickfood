import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { ReviewsSettingsForm } from "./ReviewsSettingsForm";

export const dynamic = "force-dynamic";

export default async function ReviewsSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [tenant, platform] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        reviewsEnabled: true,
        reviewsPublic: true,
        reviewsChannel: true,
        reviewsDelayMinutes: true,
        smsSender: true,
        smsCreditsRemaining: true,
        whatsappToken: true,
        whatsappInstanceId: true,
      },
    }),
    prisma.platformSettings.findFirst({
      select: { whatsappDefaultToken: true, whatsappDefaultInstanceId: true },
    }),
  ]);
  if (!tenant) redirect("/dashboard/login");

  // SMS needs paid credits. WhatsApp needs paid credits AND a connected
  // sender (either tenant-owned or the platform default).
  const smsAvailable = tenant.smsCreditsRemaining > 0;
  const whatsappConnected =
    !!(tenant.whatsappToken && tenant.whatsappInstanceId) ||
    !!(platform?.whatsappDefaultToken && platform?.whatsappDefaultInstanceId);
  const whatsappAvailable = smsAvailable && whatsappConnected;

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="איך מבקשים ביקורות מלקוחות אחרי ההזמנה" />
      <ReviewsSettingsForm
        initial={{
          enabled: tenant.reviewsEnabled,
          public: tenant.reviewsPublic,
          channel: tenant.reviewsChannel,
          delayMinutes: tenant.reviewsDelayMinutes,
          smsSender: tenant.smsSender ?? "",
        }}
        smsAvailable={smsAvailable}
        whatsappAvailable={whatsappAvailable}
        whatsappConnected={whatsappConnected}
        smsCreditsRemaining={tenant.smsCreditsRemaining}
      />
    </div>
  );
}
