import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
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
      justReturnedFromSetup={sp.setup === "complete"}
      justReturnedFromFailure={sp.setup === "failed"}
    />
  );
}
