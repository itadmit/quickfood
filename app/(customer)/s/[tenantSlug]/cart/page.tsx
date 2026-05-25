import { CustomerCart } from "@/components/customer/screens/CustomerCart";

export default async function CartPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return <CustomerCart tenantSlug={tenantSlug} />;
}
