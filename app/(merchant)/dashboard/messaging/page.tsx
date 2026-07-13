import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getSubscription, BillingHubError } from "@/lib/billing-hub/client";
import { REVIEWS_WHATSAPP_BASE_PRICE } from "@/lib/billing-hub/plans";
import { loadLoyaltyData } from "@/lib/loyalty/members";
import {
  resolveOrderNotifySettings,
  resolveMerchantNewOrderSettings,
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
        kind: { notIn: ["topup_credit", "wa_topup_credit"] },
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

  return (
    <MessagingView
      balance={tenant.smsCreditsRemaining}
      whatsappBalance={tenant.whatsappCreditsRemaining}
      smsSender={tenant.smsSender ?? ""}
      billingReady={!!(tenant.billingCustomerId && tenant.billingPaymentMethodId)}
      whatsapp={{
        token: tenant.whatsappToken ?? "",
        instanceId: tenant.whatsappInstanceId ?? "",
      }}
      orderEvents={resolveOrderNotifySettings(tenant.notifySettings, tenant.notifyChannel)}
      merchantNewOrder={resolveMerchantNewOrderSettings(tenant.notifySettings)}
      review={{
        enabled: tenant.reviewsEnabled,
        public: tenant.reviewsPublic,
        channel: tenant.reviewsChannel,
        delayMinutes: tenant.reviewsDelayMinutes,
      }}
      availability={{
        smsAvailable: a.smsAvailable,
        whatsappEnabled: a.whatsappEnabled,
        whatsappConnected: a.whatsappConnected,
        whatsappAvailable: a.whatsappAvailable,
        managedActive: a.managedActive,
      }}
      managed={managed}
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
