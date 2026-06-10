import { handler, apiJson } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/customer/favorites
 * Optional ?tenant_slug=foo to filter to one restaurant (the customer
 * profile page on each storefront lists only that tenant's favorites).
 * Without the filter, returns all favorites across tenants (a future
 * "all your favorites everywhere" account view).
 */
export const GET = handler(async (req: Request) => {
  const session = await getSession();
  // A guest simply has no favorites. Return an empty list (200) rather than
  // 401 so the storefront's on-mount fetch doesn't log a noisy Unauthorized
  // for every anonymous visitor. The toggle (POST/DELETE) still 401s to drive
  // the login hint.
  if (!session || session.type !== "customer") {
    return apiJson({ favorites: [] });
  }

  const url = new URL(req.url);
  const tenantSlug = url.searchParams.get("tenant_slug");

  const favorites = await prisma.favorite.findMany({
    where: {
      customerId: session.userId,
      ...(tenantSlug ? { item: { tenant: { slug: tenantSlug } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      item: {
        select: {
          id: true,
          name: true,
          description: true,
          basePrice: true,
          images: true,
          artType: true,
          available: true,
          tags: true,
          tenant: { select: { slug: true, name: true } },
        },
      },
    },
  });

  return apiJson({
    favorites: favorites.map((f) => ({
      item_id: f.itemId,
      created_at: f.createdAt.toISOString(),
      item: {
        id: f.item.id,
        name: f.item.name,
        description: f.item.description,
        base_price: f.item.basePrice,
        images: f.item.images,
        art_type: f.item.artType,
        available: f.item.available,
        tags: f.item.tags,
        tenant_slug: f.item.tenant.slug,
        tenant_name: f.item.tenant.name,
      },
    })),
  });
});
