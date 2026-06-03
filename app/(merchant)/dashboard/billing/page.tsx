import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import {
  getSubscription,
  BillingHubError,
  type SubscriptionDetail,
} from "@/lib/billing-hub/client";
import { BillingView } from "./BillingView";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  // Billing is the owner's alone — managers and below don't see the
  // subscription / payment method.
  if (session.role !== "owner") {
    redirect("/dashboard");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      name: true,
      billingCustomerId: true,
      billingSubscriptionId: true,
      billingPaymentMethodId: true,
      billingSetupCompletedAt: true,
      trialEndsAt: true,
      smsCreditsRemaining: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  // Fetch the live subscription state from the hub so the UI shows
  // accurate cancel-at-period-end / current-period-end values without
  // mirroring everything locally. Skip for pre-setup tenants.
  let subscription: SubscriptionDetail | null = null;
  if (tenant.billingSubscriptionId) {
    try {
      subscription = await getSubscription(tenant.billingSubscriptionId);
    } catch (err) {
      if (!(err instanceof BillingHubError) || err.status !== 404) {
        console.warn("[billing] getSubscription failed", err);
      }
    }
  }

  const sp = await searchParams;

  return (
    <BillingView
      tenant={{
        name: tenant.name,
        billingCustomerId: tenant.billingCustomerId,
        baseSubscriptionId: tenant.billingSubscriptionId,
        paymentMethodId: tenant.billingPaymentMethodId,
        setupCompletedAt: tenant.billingSetupCompletedAt?.toISOString() ?? null,
        trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
        smsCreditsRemaining: tenant.smsCreditsRemaining,
      }}
      subscription={
        subscription
          ? {
              status: subscription.status,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              currentPeriodEnd: subscription.current_period_end,
            }
          : null
      }
      justReturnedFromSetup={sp.setup === "complete"}
      justReturnedFromFailure={sp.setup === "failed"}
    />
  );
}
