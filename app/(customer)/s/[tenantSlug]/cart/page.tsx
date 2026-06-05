import ReactDOM from "react-dom";
import { PaymentProvider } from "@prisma/client";
import { CustomerCart } from "@/components/customer/screens/CustomerCart";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";

export default async function CartPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  // Warm Grow's CDN here - by the time the customer taps "המשך לתשלום"
  // and lands on /checkout, the TLS handshake is already done and the
  // SDK is in browser cache. Shaves ~200-500ms off the wallet boot.
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (tenant) {
    const growConfig = await prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: { tenantId: tenant.id, provider: PaymentProvider.grow },
      },
      select: { isActive: true },
    });
    if (growConfig?.isActive) {
      ReactDOM.preconnect("https://cdn.meshulam.co.il");
      ReactDOM.preconnect("https://secure.meshulam.co.il");
      ReactDOM.preconnect("https://sandbox.meshulam.co.il");
      ReactDOM.preload("https://cdn.meshulam.co.il/sdk/gs.min.js", {
        as: "script",
      });
    }
  }

  return <CustomerCart tenantSlug={tenantSlug} />;
}
