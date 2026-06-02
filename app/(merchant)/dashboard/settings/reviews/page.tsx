import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getSubscription, BillingHubError } from "@/lib/billing-hub/client";
import { REVIEWS_WHATSAPP_BASE_PRICE } from "@/lib/billing-hub/plans";
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
        billingCustomerId: true,
        billingPaymentMethodId: true,
        reviewsWhatsappSubscriptionId: true,
      },
    }),
    prisma.platformSettings.findFirst({
      select: { whatsappDefaultToken: true, whatsappDefaultInstanceId: true },
    }),
  ]);
  if (!tenant) redirect("/dashboard/login");

  // SMS needs paid credits. WhatsApp (BYO) needs paid credits AND a connected
  // sender (either tenant-owned or the platform default).
  const smsAvailable = tenant.smsCreditsRemaining > 0;
  const whatsappConnected =
    !!(tenant.whatsappToken && tenant.whatsappInstanceId) ||
    !!(platform?.whatsappDefaultToken && platform?.whatsappDefaultInstanceId);
  const whatsappAvailable = smsAvailable && whatsappConnected;

  // Managed-WhatsApp add-on: live status from the billing hub when a sub id is
  // mirrored locally. On hub error fall back to "active mirrored locally" so a
  // hub outage doesn't pretend the merchant isn't paying.
  const managed = {
    active: !!tenant.reviewsWhatsappSubscriptionId,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null as string | null,
    basePrice: REVIEWS_WHATSAPP_BASE_PRICE,
  };
  if (tenant.reviewsWhatsappSubscriptionId) {
    try {
      const detail = await getSubscription(tenant.reviewsWhatsappSubscriptionId);
      managed.cancelAtPeriodEnd = detail.cancel_at_period_end;
      managed.currentPeriodEnd = detail.current_period_end;
    } catch (err) {
      if (!(err instanceof BillingHubError)) throw err;
    }
  }
  const billingReady = !!(
    tenant.billingCustomerId && tenant.billingPaymentMethodId
  );

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
        managed={managed}
        billingReady={billingReady}
      />
    </div>
  );
}
