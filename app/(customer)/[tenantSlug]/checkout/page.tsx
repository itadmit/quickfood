import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { CustomerCheckout } from "@/components/customer/screens/CustomerCheckout";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const [settings, growConfig] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { reviewsChannel: true, reviewsEnabled: true },
    }),
    prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: { tenantId: tenant.id, provider: "grow" },
      },
      select: { testMode: true, isActive: true },
    }),
  ]);

  const requireEmail =
    !!settings?.reviewsEnabled && settings.reviewsChannel === "email";

  // Pre-load Grow's SDK at page mount when the tenant has it active. The SDK
  // needs ~1s of async work after init() before it can render the wallet
  // safely; doing it at page open avoids "SDK was not loaded as needed" when
  // the user clicks "pay" before that work finishes.
  const growEnabled = !!growConfig?.isActive;
  const growTestMode = growConfig?.testMode ?? true;

  return (
    <CustomerCheckout
      tenantSlug={tenantSlug}
      requireEmail={requireEmail}
      growEnabled={growEnabled}
      growTestMode={growTestMode}
    />
  );
}
