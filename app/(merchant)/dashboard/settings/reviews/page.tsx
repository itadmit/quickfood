import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsTabs } from "../SettingsTabs";
import { ReviewsSettingsForm } from "./ReviewsSettingsForm";

export const dynamic = "force-dynamic";

export default async function ReviewsSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      reviewsEnabled: true,
      reviewsPublic: true,
      reviewsChannel: true,
      reviewsDelayMinutes: true,
      smsSender: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">ביקורות לקוחות</p>
      </header>
      <SettingsTabs />
      <ReviewsSettingsForm
        initial={{
          enabled: tenant.reviewsEnabled,
          public: tenant.reviewsPublic,
          channel: tenant.reviewsChannel,
          delayMinutes: tenant.reviewsDelayMinutes,
          smsSender: tenant.smsSender ?? "",
        }}
      />
    </div>
  );
}
