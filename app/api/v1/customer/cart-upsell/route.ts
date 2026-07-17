import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 8;
const FALLBACK_PATTERNS = [
  /משק/, // משקאות
  /שתי/, // שתייה
  /מתוק/, // מתוקים
  /קינוח/,
  /drink/i,
  /beverage/i,
  /soda/i,
  /soft/i,
];

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("tenant");
  const excludeParam = url.searchParams.get("exclude") ?? "";
  // flag=checkout serves the one-shot "anything else?" interstitial fired
  // when the customer taps המשך לתשלום - categories opted in via
  // upsellBeforeCheckout, no name-heuristic fallback, capped tighter.
  const checkoutFlag = url.searchParams.get("flag") === "checkout";
  if (!slug) return apiError("validation_error", "missing tenant", 422);

  const tenant = await resolveTenantBySlug(slug);
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  const exclude = new Set(
    excludeParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const [categories, tenantRow, flaggedItemCount] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { position: "asc" },
    }),
    prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { cartUpsellTitle: true },
    }),
    prisma.menuItem.count({ where: { tenantId: tenant.id, upsellInCart: true } }),
  ]);

  // Primary: categories explicitly flagged by the merchant. The checkout
  // interstitial is strictly opt-in (upsellBeforeCheckout); the in-cart
  // carousel keeps its name-heuristic fallback.
  let chosen = categories.filter((c) =>
    checkoutFlag ? c.upsellBeforeCheckout : c.upsellInCart,
  );

  if (!checkoutFlag && chosen.length === 0 && flaggedItemCount === 0) {
    chosen = categories.filter((c) =>
      FALLBACK_PATTERNS.some((re) => re.test(c.name)),
    );
  }

  if (chosen.length === 0 && (checkoutFlag || flaggedItemCount === 0)) {
    return apiJson({ items: [], heading: null });
  }

  // Hand-picked items merge with the flagged categories' items.
  const items = await prisma.menuItem.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        ...(chosen.length > 0 ? [{ categoryId: { in: chosen.map((c) => c.id) } }] : []),
        ...(checkoutFlag ? [] : [{ upsellInCart: true }]),
      ],
      available: true,
      ...(exclude.size > 0 ? { id: { notIn: [...exclude] } } : {}),
    },
    orderBy: checkoutFlag
      ? [{ basePrice: "asc" }, { position: "asc" }]
      : [{ upsellInCart: "desc" }, { featured: "desc" }, { position: "asc" }],
    take: checkoutFlag ? 4 : MAX_ITEMS,
    select: {
      id: true,
      name: true,
      basePrice: true,
      images: true,
      imageUrl: true,
      // Counts let the cart-side "+" button decide whether tapping it
      // can add to cart directly (no options, no size choice required)
      // or has to open the picker modal first. Without this, the
      // upsell card always opened the modal even for a Coke.
      _count: { select: { sizes: true } },
      optionGroups: {
        select: { id: true, required: true, templateSet: { select: { required: true } } },
      },
    },
  });

  return apiJson({
    heading:
      tenantRow?.cartUpsellTitle?.trim() ||
      (chosen.length === 1 ? chosen[0].name : "מומלץ עבורך"),
    items: items.map((i) => {
      const hasRequiredGroup = i.optionGroups.some(
        (g) => (g.templateSet?.required ?? g.required) === true,
      );
      const hasMultipleSizes = i._count.sizes > 1;
      const hasAnyGroup = i.optionGroups.length > 0;
      return {
        id: i.id,
        name: i.name,
        basePrice: i.basePrice,
        imageUrl: i.images?.[0] ?? i.imageUrl ?? null,
        // True when tapping "+" has to open the picker: required
        // modifiers OR a size choice. Optional-only groups don't
        // force the modal - the user can still add the bare item.
        needsConfig: hasRequiredGroup || hasMultipleSizes,
        // Flag the "you can still customize" case so the modal CTA
        // can hint at the alternative path.
        hasOptionalGroups: !hasRequiredGroup && hasAnyGroup,
      };
    }),
  });
});
