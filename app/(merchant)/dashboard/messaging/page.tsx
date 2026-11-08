import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { loadLoyaltyData } from "@/lib/loyalty/members";
import {
  resolveOrderNotifySettings,
  resolveMerchantNewOrderSettings,
  resolveCourierAssignedSettings,
  resolveReviewText,
} from "@/lib/messaging/notify-settings";
import { resolveMessagingAvailability } from "@/lib/messaging/availability";
import { MessagingView } from "./MessagingView";

export const dynamic = "force-dynamic";

export default async function MessagingPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const [tenant, logs] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: {
        name: true,
        notifyChannel: true,
        notifySettings: true,
        reviewsEnabled: true,
        reviewsPublic: true,
        reviewsChannel: true,
        reviewsDelayMinutes: true,
        smsSender: true,
        smsCreditsRemaining: true,
        whatsappCreditsRemaining: true,
        whatsappEnabled: true,
        whatsappToken: true,
        whatsappInstanceId: true,
        reviewsWhatsappSubscriptionId: true,
        billingCustomerId: true,
        billingPaymentMethodId: true,
      },
    }),
    prisma.smsLog.findMany({
      where: {
        tenantId: session.tenantId,
        // Hide internal/platform rows: billing top-ups, customer login/kiosk
        // OTP codes (private auth codes the merchant must not see), and the
        // platform's own onboarding message to the merchant. The send history
        // is for the store's outbound customer notifications only.
        kind: {
          notIn: [
            "topup_credit",
            "wa_topup_credit",
            "login_otp",
            "kiosk_otp",
            "admin_message",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        to: true,
        body: true,
        channel: true,
        kind: true,
        status: true,
        providerMsg: true,
        createdAt: true,
      },
    }),
  ]);
  if (!tenant) redirect("/dashboard/login");

  const { config, rows } = await loadLoyaltyData(
    session.tenantId,
    tenant.name ?? "העסק",
  );

  const a = resolveMessagingAvailability(tenant);


  return (
    <MessagingView
      balance={tenant.smsCreditsRemaining}
      smsSender={tenant.smsSender ?? ""}
      billingReady={!!(tenant.billingCustomerId && tenant.billingPaymentMethodId)}
      orderEvents={resolveOrderNotifySettings(tenant.notifySettings, tenant.notifyChannel)}
      merchantNewOrder={resolveMerchantNewOrderSettings(tenant.notifySettings)}
      courierAssigned={resolveCourierAssignedSettings(tenant.notifySettings)}
      review={{
        enabled: tenant.reviewsEnabled,
        public: tenant.reviewsPublic,
        channel: tenant.reviewsChannel === "whatsapp" || tenant.reviewsChannel === "whatsapp_managed" ? "sms" : tenant.reviewsChannel,
        delayMinutes: tenant.reviewsDelayMinutes,
        text: resolveReviewText(tenant.notifySettings) ?? "",
      }}
      availability={{
        smsAvailable: a.smsAvailable,
        whatsappEnabled: a.whatsappEnabled,
        whatsappConnected: a.whatsappConnected,
        managedActive: a.managedActive,
      }}
      tiers={{
        silver: config.tiers.silver.name,
        gold: config.tiers.gold.name,
        platinum: config.tiers.platinum.name,
      }}
      audience={rows
        .filter((r) => r.isMember)
        .map((r) => ({ tier: r.tier, hasEmail: !!r.email, hasPhone: !!r.phone }))}
      logs={logs.map((l) => ({
        id: l.id,
        to: l.to,
        body: l.body,
        channel: l.channel,
        kind: l.kind,
        status: l.status,
        providerMsg: l.providerMsg,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}
