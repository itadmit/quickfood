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

  const settings = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { reviewsChannel: true, reviewsEnabled: true },
  });

  const requireEmail =
    !!settings?.reviewsEnabled && settings.reviewsChannel === "email";

  return <CustomerCheckout tenantSlug={tenantSlug} requireEmail={requireEmail} />;
}
