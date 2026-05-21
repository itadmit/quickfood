import { notFound } from "next/navigation";
import { PaymentProvider } from "@prisma/client";
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

  // Each query wrapped in its own try so one bad lookup doesn't kill the
  // whole checkout page render. (Both are non-critical — checkout still
  // works without them, just with sane defaults.)
  let settings: { reviewsChannel: string; reviewsEnabled: boolean } | null = null;
  let growConfig: { testMode: boolean; isActive: boolean } | null = null;
  try {
    settings = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { reviewsChannel: true, reviewsEnabled: true },
    });
  } catch (err) {
    console.error("[checkout/page] tenant settings lookup failed", err);
  }
  try {
    growConfig = await prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: {
          tenantId: tenant.id,
          provider: PaymentProvider.grow,
        },
      },
      select: { testMode: true, isActive: true },
    });
  } catch (err) {
    console.error("[checkout/page] grow config lookup failed", err);
  }

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
