import { notFound } from "next/navigation";
import ReactDOM from "react-dom";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { getSession } from "@/lib/auth/session";
import { resolveTerms } from "@/lib/legal/terms";
import { resolveLoyaltyConfig } from "@/lib/loyalty/config";
import { getActiveCardProviderSummary } from "@/lib/payments/factory";
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

  // A logged-in customer should never re-type their identity at checkout.
  // Pull their saved contact details and prefill the form (also drives the
  // "logged in as..." indicator + hides the guest login prompt).
  let initialCustomer: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  } | null = null;
  let initialAddress: {
    street: string;
    city: string;
    apartment: string | null;
    floor: string | null;
    notes: string | null;
  } | null = null;
  try {
    const session = await getSession();
    if (session?.type === "customer") {
      const [c, addr] = await Promise.all([
        prisma.customer.findUnique({
          where: { id: session.userId },
          select: { firstName: true, lastName: true, phone: true, email: true },
        }),
        prisma.address.findFirst({
          where: { customerId: session.userId },
          orderBy: [{ isDefault: "desc" }],
          select: { street: true, city: true, apartment: true, floor: true, notes: true },
        }),
      ]);
      if (c) {
        initialCustomer = {
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          email: c.email,
        };
      }
      if (addr) {
        initialAddress = {
          street: addr.street,
          city: addr.city,
          apartment: addr.apartment,
          floor: addr.floor,
          notes: addr.notes,
        };
      }
    }
  } catch (err) {
    console.error("[checkout/page] customer session lookup failed", err);
  }

  // Each query wrapped in its own try so one bad lookup doesn't kill the
  // whole checkout page render. (Both are non-critical - checkout still
  // works without them, just with sane defaults.)
  let settings: {
    reviewsChannel: string;
    reviewsEnabled: boolean;
    pickupEnabled: boolean;
    checkoutRequireEmail: boolean;
    checkoutShowAttribution: boolean;
  } | null = null;
  try {
    settings = await prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        reviewsChannel: true,
        reviewsEnabled: true,
        pickupEnabled: true,
        loyaltyConfig: true,
        checkoutRequireEmail: true,
        checkoutShowAttribution: true,
      },
    });
  } catch (err) {
    console.error("[checkout/page] tenant settings lookup failed", err);
  }

  const loyalty = resolveLoyaltyConfig(
    (settings as { loyaltyConfig?: unknown } | null)?.loyaltyConfig,
    tenant.name,
  );
  let cardProvider: Awaited<ReturnType<typeof getActiveCardProviderSummary>> = null;
  try {
    cardProvider = await getActiveCardProviderSummary(tenant.id);
  } catch (err) {
    console.error("[checkout/page] card provider lookup failed", err);
  }

  // Email is required only when reviews go out by email, or the merchant
  // explicitly opted in (Settings -> Checkout). Card payments no longer force
  // it - the payment provider issues + emails the tax invoice itself.
  const requireEmail =
    (!!settings?.reviewsEnabled && settings.reviewsChannel === "email") ||
    (settings?.checkoutRequireEmail ?? false);

  const cardEnabled = !!cardProvider;

  // SSR-preconnect to Grow's CDN + preload the SDK script so the browser
  // starts downloading gs.min.js in parallel with HTML transfer/hydration.
  // Only for Grow - CardCom loads its own hosted page, no SDK to preload.
  if (cardProvider?.provider === "grow") {
    ReactDOM.preconnect("https://cdn.meshulam.co.il");
    ReactDOM.preconnect("https://secure.meshulam.co.il");
    ReactDOM.preconnect("https://sandbox.meshulam.co.il");
    ReactDOM.preload("https://cdn.meshulam.co.il/sdk/gs.min.js", {
      as: "script",
      fetchPriority: "high",
    });
  }

  const termsText = resolveTerms(tenant.termsText, {
    businessName: tenant.name,
    vatNumber: tenant.vatNumber,
    address: tenant.branches[0]?.address ?? null,
    phone: tenant.branches[0]?.phone ?? null,
    email: tenant.branches[0]?.email ?? null,
    supportsDelivery: (tenant.branches[0]?.zones?.length ?? 0) > 0,
  });

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
      initialCustomer={initialCustomer}
      initialAddress={initialAddress}
      requireEmail={requireEmail}
      cardEnabled={cardEnabled}
      provider={cardProvider?.provider ?? null}
      testMode={cardProvider?.testMode ?? true}
      displayMode={cardProvider?.displayMode ?? null}
      showAttribution={settings?.checkoutShowAttribution ?? true}
      deliveryCities={deliveryCities}
      pickupEnabled={settings?.pickupEnabled ?? true}
      termsText={termsText}
      loyaltyCheckout={{
        // Logged-in customers are already members (auto-enrolled), so the
        // opt-in only shows to guests.
        show: loyalty.showCheckoutCheckbox && !initialCustomer,
        text: loyalty.checkoutConsentText,
      }}
    />
  );
}
