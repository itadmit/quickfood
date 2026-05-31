import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/customer/cart-bundles?tenant=<slug>&items=id1,id2,id3
 *
 * Returns the active bundle offers whose triggers fire on the
 * customer's current cart contents. Excludes bundles where every
 * addon item is already in the cart (the customer's already got
 * what we'd be pitching).
 */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("tenant");
  const itemsParam = url.searchParams.get("items") ?? "";
  if (!slug) return apiError("validation_error", "missing tenant", 422);

  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  const inCart = new Set(
    itemsParam.split(",").map((s) => s.trim()).filter(Boolean),
  );
  if (inCart.size === 0) return apiJson({ bundles: [] });

  const now = new Date();
  const bundles = await prisma.bundleOffer.findMany({
    where: {
      tenantId: tenant.id,
      active: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
      ],
      triggers: { some: { itemId: { in: [...inCart] } } },
    },
    include: {
      addons: {
        include: {
          item: {
            select: {
              id: true,
              name: true,
              basePrice: true,
              images: true,
              imageUrl: true,
              available: true,
            },
          },
        },
      },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  const out = bundles
    .map((b) => {
      const availableAddons = b.addons.filter((a) => a.item.available);
      if (availableAddons.length === 0) return null;
      const allInCart = availableAddons.every((a) => inCart.has(a.itemId));
      if (allInCart) return null;
      const fullPrice = availableAddons.reduce(
        (acc, a) => acc + a.item.basePrice * a.qty,
        0,
      );
      const savings = Math.max(0, fullPrice - b.bundlePrice);
      return {
        id: b.id,
        name: b.name,
        description: b.description,
        image_url: b.imageUrl,
        bundle_price: b.bundlePrice,
        full_price: fullPrice,
        savings,
        addons: availableAddons.map((a) => ({
          item_id: a.itemId,
          name: a.item.name,
          base_price: a.item.basePrice,
          image_url: a.item.images?.[0] ?? a.item.imageUrl ?? null,
          qty: a.qty,
        })),
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  return apiJson({ bundles: out });
});
