import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactDOM from "react-dom";
import {
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PendingPaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { normalizeKioskOverrides } from "@/lib/i18n/kiosk-messages";
import { initiateOrderPayment } from "@/lib/payments/initiate-payment";
import { getActiveCardProviderSummary } from "@/lib/payments/factory";
import { canUseOwnerTestCard } from "@/lib/payments/owner-test-access";
import { declineMessage } from "@/lib/payments/decline-message";
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

  const allowOwnerTest = await canUseOwnerTestCard(tenant.id);
  const [order, cardProvider, lastAttempt] = await Promise.all([
    prisma.order.findFirst({
      where: { id: orderId, tenantId: tenant.id },
      select: {
        id: true,
        number: true,
        total: true,
        status: true,
        source: true,
        paymentStatus: true,
        paymentMethod: true,
        invoiceNumber: true,
        invoiceUrl: true,
        customerEmailSnap: true,
      },
    }),
    getActiveCardProviderSummary(tenant.id, { allowOwnerTest }),
    prisma.pendingPayment.findFirst({
      where: { orderId, tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, provider: true, providerResponse: true },
    }),
  ]);
  if (!order) notFound();

  const declined =
    !justPaid &&
    order.paymentStatus === PaymentStatus.pending &&
    lastAttempt?.status === PendingPaymentStatus.failed
      ? declineMessage(lastAttempt.provider, lastAttempt.providerResponse)
      : null;
  const cashAvailable =
    tenant.acceptsCash &&
    order.source !== OrderSource.kiosk &&
    order.source !== OrderSource.pos &&
    order.status !== OrderStatus.cancelled &&
    order.status !== OrderStatus.refunded;

  const cardEnabled = !!cardProvider;
  const isOpenForPayment =
    !justPaid &&
    order.paymentStatus !== PaymentStatus.paid &&
    order.paymentStatus !== PaymentStatus.refunded &&
    order.paymentMethod !== PaymentMethod.cash;

  let initialAuthCode: string | null = null;
  let initialPaymentUrl: string | null = null;
  if (cardEnabled && isOpenForPayment && !declined) {
    try {
      const initResult = await initiateOrderPayment(order.id, { allowOwnerTest });
      if (initResult.ok) {
        initialAuthCode = initResult.data.sdk_auth_code;
        initialPaymentUrl = initResult.data.payment_url;
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
      cardEnabled={cardEnabled}
      provider={cardProvider?.provider ?? null}
      testMode={cardProvider?.testMode ?? true}
      displayMode={cardProvider?.displayMode ?? null}
      initialAuthCode={initialAuthCode}
      initialPaymentUrl={initialPaymentUrl}
      stringOverrides={normalizeKioskOverrides(tenant.kioskStringOverrides)}
      justPaid={justPaid}
      declineMessage={declined}
      cashAvailable={cashAvailable}
    />
  );
}
