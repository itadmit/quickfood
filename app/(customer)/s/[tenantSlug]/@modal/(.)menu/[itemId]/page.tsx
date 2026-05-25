import { notFound } from "next/navigation";
import { loadMenuItemForCustomer } from "@/lib/menu-item-load";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";

export const dynamic = "force-dynamic";

/**
 * Intercepting route for the customer item page. When the customer
 * is on the storefront and clicks an item Link, this slot activates
 * inside the parent `@modal` parallel slot and renders
 * <ItemDetail inModal /> — the surrounding `layout.tsx` wraps it in
 * <ItemDetailModal> chrome so the URL changes and the menu stays
 * visible underneath.
 *
 * A direct navigation to `/[tenantSlug]/menu/[itemId]` still hits
 * the regular page (see ../../menu/[itemId]/page.tsx) and renders
 * the full-screen item view — same data through the same loader.
 */
export default async function MenuItemModalRoute({
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
      inModal
    />
  );
}
