import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactDOM from "react-dom";
import { PaymentMethod, PaymentProvider, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { normalizeKioskOverrides } from "@/lib/i18n/kiosk-messages";
import { initiateOrderPayment } from "@/lib/payments/initiate-payment";
import { PayPage } from "./PayPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; orderId: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  return { title: `${tenant?.name ?? "QuickFood"} · תשלום` };
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  const head = local.length <= 2 ? `${local[0] ?? ""}` : local.slice(0, 2);
  return `${head}***@${domain}`;
}

export default async function PayRoute({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; orderId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug, orderId } = await params;
  const sp = (await searchParams) ?? {};
  const justPaid = sp.paid === "1";

  ReactDOM.preconnect("https://cdn.meshulam.co.il");
  ReactDOM.preconnect("https://secure.meshulam.co.il");
  ReactDOM.preconnect("https://sandbox.meshulam.co.il");
  ReactDOM.preload("https://cdn.meshulam.co.il/sdk/gs.min.js", {
    as: "script",
    fetchPriority: "high",
  });

  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const [order, growConfig] = await Promise.all([
    prisma.order.findFirst({
      where: { id: orderId, tenantId: tenant.id },
      select: {
        id: true,
        number: true,
        total: true,
        paymentStatus: true,
        paymentMethod: true,
        invoiceNumber: true,
        invoiceUrl: true,
        customerEmailSnap: true,
      },
    }),
    prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: { tenantId: tenant.id, provider: PaymentProvider.grow },
      },
      select: { testMode: true, isActive: true },
    }),
  ]);
  if (!order) notFound();

  const growEnabled = !!growConfig?.isActive;
  const isOpenForPayment =
    !justPaid &&
    order.paymentStatus !== PaymentStatus.paid &&
    order.paymentStatus !== PaymentStatus.refunded &&
    order.paymentMethod !== PaymentMethod.cash;

  let initialAuthCode: string | null = null;
  if (growEnabled && isOpenForPayment) {
    try {
      const initResult = await initiateOrderPayment(order.id);
      if (initResult.ok) {
        initialAuthCode = initResult.data.sdk_auth_code;
      } else {
        // eslint-disable-next-line no-console
        console.warn("[pay] ssr initiate failed", {
          code: initResult.code,
          message: initResult.message,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[pay] ssr initiate threw", err);
    }
  }

  return (
    <PayPage
      tenantSlug={tenantSlug}
      tenantName={tenant.name}
      order={{
        id: order.id,
        number: order.number,
        total: order.total,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        invoiceNumber: order.invoiceNumber,
        invoiceUrl: order.invoiceUrl,
        customerEmailMasked: maskEmail(order.customerEmailSnap),
      }}
      growEnabled={growEnabled}
      growTestMode={growConfig?.testMode ?? true}
      initialAuthCode={initialAuthCode}
      stringOverrides={normalizeKioskOverrides(tenant.kioskStringOverrides)}
      justPaid={justPaid}
    />
  );
}
