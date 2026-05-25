import { notFound } from "next/navigation";
import { loadMenuItemForCustomer } from "@/lib/menu-item-load";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";

export const dynamic = "force-dynamic";

export default async function ItemPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; itemId: string }>;
}) {
  const { tenantSlug, itemId } = await params;
  const loaded = await loadMenuItemForCustomer(tenantSlug, itemId);
  if (!loaded) notFound();

  return (
    <ItemDetail
      tenantSlug={loaded.tenant.slug}
      businessType={loaded.tenant.businessType}
      item={loaded.item}
    />
  );
}
