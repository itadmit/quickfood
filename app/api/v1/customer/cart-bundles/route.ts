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
      triggers: { select: { itemId: true } },
      linkedItem: {
        select: {
          id: true,
          name: true,
          basePrice: true,
          images: true,
          imageUrl: true,
          available: true,
        },
      },
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

  // Wolt model first: if the bundle is wired to a `linkedItem`, the
  // suggestion is "upgrade your <trigger> to <combo>" — savings are
  // computed against the trigger item prices the customer currently
  // has in cart, vs the combo's own price. The customer flow opens
  // the combo's normal ItemDetail to pick modifiers (drink, size, …).
  // Legacy bundles with `addons` populated fall back to the old
  // "add these addons to your cart" suggestion until the merchant
  // migrates them in the dashboard.
  const triggerItemIds = new Set<string>();
  for (const b of bundles) {
    for (const t of b.triggers) triggerItemIds.add(t.itemId);
  }
  const triggerItems = await prisma.menuItem.findMany({
    where: { id: { in: [...triggerItemIds] } },
    select: { id: true, basePrice: true },
  });
  const triggerPriceById = new Map(triggerItems.map((it) => [it.id, it.basePrice]));

  const out = bundles
    .map((b) => {
      // Match the trigger items the customer actually has in cart so we
      // can compute "what would they save by upgrading?" against real
      // prices, not the full trigger catalog.
      const matchedTriggers = b.triggers
        .map((t) => t.itemId)
        .filter((id) => inCart.has(id));
      if (matchedTriggers.length === 0) return null;

      if (b.linkedItem && b.linkedItem.available) {
        // Skip if the upgrade product itself is already in the cart —
        // no point re-pitching the combo they've already added.
        if (inCart.has(b.linkedItem.id)) return null;
        const triggerSum = matchedTriggers.reduce(
          (acc, id) => acc + (triggerPriceById.get(id) ?? 0),
          0,
        );
        const savings = Math.max(0, triggerSum - b.linkedItem.basePrice);
        return {
          id: b.id,
          name: b.name,
          description: b.description,
          image_url: b.imageUrl,
          mode: "linked" as const,
          bundle_price: b.linkedItem.basePrice,
          full_price: triggerSum,
          savings,
          linked_item: {
            id: b.linkedItem.id,
            name: b.linkedItem.name,
            base_price: b.linkedItem.basePrice,
            image_url:
              b.linkedItem.images?.[0] ?? b.linkedItem.imageUrl ?? null,
          },
          trigger_item_ids: matchedTriggers,
        };
      }

      // Legacy addons path — kept until pre-migration bundles are
      // re-configured. New UI hides this once the merchant flips
      // them over.
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
        mode: "legacy" as const,
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
        trigger_item_ids: matchedTriggers,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);

  return apiJson({ bundles: out });
});
