import { CustomerCheckout } from "@/components/customer/screens/CustomerCheckout";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <CustomerCheckout tenantSlug={tenantSlug} />;
}
