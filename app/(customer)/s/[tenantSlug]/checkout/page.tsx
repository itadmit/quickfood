import { notFound } from "next/navigation";
import ReactDOM from "react-dom";
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
  // whole checkout page render. (Both are non-critical - checkout still
  // works without them, just with sane defaults.)
  let settings: {
    reviewsChannel: string;
    reviewsEnabled: boolean;
    pickupEnabled: boolean;
  } | null = null;
  let growConfig: { testMode: boolean; isActive: boolean } | null = null;
  try {
    settings = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { reviewsChannel: true, reviewsEnabled: true, pickupEnabled: true },
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

  const growEnabled = !!growConfig?.isActive;
  const growTestMode = growConfig?.testMode ?? true;

  // SSR-preconnect to Grow's CDN + preload the SDK script so the browser
  // starts downloading gs.min.js in parallel with HTML transfer/hydration.
  // Without this the SDK only starts downloading after GrowPaymentSdk
  // mounts client-side - costing ~500-800ms on first paint. Mirrors the
  // perf work on /pay-checkout/[checkoutId] and /pay/[orderId].
  if (growEnabled) {
    ReactDOM.preconnect("https://cdn.meshulam.co.il");
    ReactDOM.preconnect("https://secure.meshulam.co.il");
    ReactDOM.preconnect("https://sandbox.meshulam.co.il");
    ReactDOM.preload("https://cdn.meshulam.co.il/sdk/gs.min.js", {
      as: "script",
      fetchPriority: "high",
    });
  }

  const branchId = tenant.branches[0]?.id;
  const deliveryCities: string[] = [];
  if (branchId) {
    const zones = await prisma.deliveryZone.findMany({
      where: { branchId, active: true },
      select: { name: true, cities: true },
    });
    const seen = new Set<string>();
    for (const z of zones) {
      const list = z.cities.length > 0 ? z.cities : [z.name];
      for (const c of list) {
        const trimmed = c.trim();
        if (!trimmed) continue;
        const key = trimmed.toLocaleLowerCase("he-IL");
        if (seen.has(key)) continue;
        seen.add(key);
        deliveryCities.push(trimmed);
      }
    }
    deliveryCities.sort((a, b) => a.localeCompare(b, "he-IL"));
  }

  return (
    <CustomerCheckout
      tenantSlug={tenantSlug}
      requireEmail={requireEmail}
      growEnabled={growEnabled}
      growTestMode={growTestMode}
      deliveryCities={deliveryCities}
      pickupEnabled={settings?.pickupEnabled ?? true}
    />
  );
}
