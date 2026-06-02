import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactDOM from "react-dom";
import { PaymentProvider } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { normalizeKioskOverrides } from "@/lib/i18n/kiosk-messages";
import { initiateKioskCheckoutPayment } from "@/lib/payments/initiate-kiosk-checkout-payment";
import { PayCheckoutPage } from "./PayCheckoutPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  return { title: `${tenant?.name ?? "QuickFood"} · תשלום` };
}

export default async function PayCheckoutRoute({
  params,
}: {
  params: Promise<{ tenantSlug: string; checkoutId: string }>;
}) {
  const { tenantSlug, checkoutId } = await params;

  ReactDOM.preconnect("https://cdn.meshulam.co.il");
  ReactDOM.preconnect("https://secure.meshulam.co.il");
  ReactDOM.preconnect("https://sandbox.meshulam.co.il");
  ReactDOM.preload("https://cdn.meshulam.co.il/sdk/gs.min.js", {
    as: "script",
    fetchPriority: "high",
  });

  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const [checkout, growConfig] = await Promise.all([
    prisma.kioskPendingCheckout.findFirst({
      where: { id: checkoutId, tenantId: tenant.id },
      select: {
        id: true,
        amount: true,
        status: true,
        orderId: true,
        expiresAt: true,
      },
    }),
    prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: { tenantId: tenant.id, provider: PaymentProvider.grow },
      },
      select: { testMode: true, isActive: true },
    }),
  ]);
  if (!checkout) notFound();

  const growEnabled = !!growConfig?.isActive;
  const isOpenForPayment =
    checkout.status === "pending" && checkout.expiresAt > new Date();

  let initialAuthCode: string | null = null;
  if (growEnabled && isOpenForPayment) {
    try {
      const initResult = await initiateKioskCheckoutPayment(checkoutId);
      if (initResult.ok) {
        initialAuthCode = initResult.data.sdk_auth_code;
      } else {
        // eslint-disable-next-line no-console
        console.warn("[pay-checkout] ssr initiate failed", {
          code: initResult.code,
          message: initResult.message,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[pay-checkout] ssr initiate threw", err);
    }
  }

  return (
    <PayCheckoutPage
      tenantSlug={tenantSlug}
      tenantName={tenant.name}
      checkout={{
        id: checkout.id,
        amount: checkout.amount,
        status: checkout.status,
        orderId: checkout.orderId,
        expiresAt: checkout.expiresAt.toISOString(),
      }}
      growEnabled={growEnabled}
      growTestMode={growConfig?.testMode ?? true}
      initialAuthCode={initialAuthCode}
      stringOverrides={normalizeKioskOverrides(tenant.kioskStringOverrides)}
    />
  );
}
