import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";
import { loadMenuItemForCustomer, type MenuItemForCustomer } from "@/lib/menu-item-load";
import { KioskApp } from "./KioskApp";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  const name = tenant?.name ?? "QuickFood";
  // Link the per-tenant manifest + tell iOS/Android this page is a
  // standalone-capable web app. When the merchant taps "Add to Home
  // Screen" the OS reads the manifest endpoint below and uses the
  // venue's logo + theme color for the installed shortcut.
  return {
    title: `${name} · קיוסק`,
    manifest: `/s/${tenantSlug}/kiosk/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: name,
    },
    other: {
      "apple-mobile-web-app-capable": "yes",
      "mobile-web-app-capable": "yes",
    },
  };
}

export default async function KioskPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant) notFound();
  if (!tenant.kioskEnabled) notFound();

  const [categories, items] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { position: "asc" },
      // upsellInCart powers the "Anything else?" carousel inside the
      // kiosk cart sheet — same flag the storefront uses.
      // upsellBeforeCheckout powers the dessert-prompt interstitial.
      select: { id: true, name: true, upsellInCart: true, upsellBeforeCheckout: true },
    }),
    prisma.menuItem.findMany({
      where: { tenantId: tenant.id, available: true },
      orderBy: [{ featured: "desc" }, { position: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        basePrice: true,
        artType: true,
        images: true,
        imageUrl: true,
        tags: true,
        categoryId: true,
        featured: true,
      },
    }),
  ]);

  // Kiosks don't tolerate a fetch-and-skeleton flicker when the user
  // taps an item — the experience needs to feel like a native app. So
  // we pre-load every item's full sizes + option groups on the server
  // and ship it down with the initial render. loadMenuItemForCustomer
  // is `unstable_cache`d per item so this stays cheap on warm.
  const itemDetails = await Promise.all(
    items.map((it) => loadMenuItemForCustomer(tenant.slug, it.id)),
  );
  const itemDataMap: Record<string, MenuItemForCustomer> = {};
  for (const d of itemDetails) {
    if (d?.item) itemDataMap[d.item.id] = d.item;
  }

  return (
    <KioskApp
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      logoUrl={tenant.logoUrl ?? null}
      coverImage={tenant.coverImage ?? null}
      welcomeText={tenant.kioskWelcomeText}
      idleSeconds={tenant.kioskIdleSeconds}
      businessType={tenant.businessType}
      featuredBadgeLabel={tenant.featuredBadgeLabel}
      categories={categories.map(({ id, name }) => ({ id, name }))}
      upsellCategoryIds={categories.filter((c) => c.upsellInCart).map((c) => c.id)}
      checkoutUpsellCategoryIds={categories.filter((c) => c.upsellBeforeCheckout).map((c) => c.id)}
      items={items.map((it) => ({
        id: it.id,
        name: it.name,
        description: it.description ?? null,
        basePrice: it.basePrice,
        artType: it.artType,
        imageUrl: it.images?.[0] ?? it.imageUrl ?? null,
        tags: it.tags,
        categoryId: it.categoryId,
        featured: it.featured,
      }))}
      itemDetails={itemDataMap}
    />
  );
}
