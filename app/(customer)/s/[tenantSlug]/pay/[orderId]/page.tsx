import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PaymentProvider } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
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

  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: tenant.id },
    select: {
      id: true,
      number: true,
      total: true,
      paymentStatus: true,
      paymentMethod: true,
      invoiceNumber: true,
      invoiceUrl: true,
    },
  });
  if (!order) notFound();

  const growConfig = await prisma.paymentProviderConfig.findUnique({
    where: {
      tenantId_provider: { tenantId: tenant.id, provider: PaymentProvider.grow },
    },
    select: { testMode: true, isActive: true },
  });

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
      }}
      growEnabled={!!growConfig?.isActive}
      growTestMode={growConfig?.testMode ?? true}
      justPaid={justPaid}
    />
  );
}
