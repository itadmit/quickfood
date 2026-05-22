import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BulkPriceSchema = z
  .object({
    scope: z.enum(["all", "category", "ids"]),
    category_id: z.string().uuid().nullable().optional(),
    item_ids: z.array(z.string().uuid()).optional(),
    adjustment: z.object({
      type: z.enum([
        "percent_increase",
        "percent_decrease",
        "fixed_add",
        "fixed_subtract",
        "set",
      ]),
      // For percent_*: 0..200. For fixed_*: 0..10000. For set: 0..10000.
      value: z.number().min(0).max(10000),
    }),
  })
  .refine(
    (b) => b.scope !== "category" || !!b.category_id,
    { message: "category_id required when scope=category" },
  )
  .refine(
    (b) => b.scope !== "ids" || (b.item_ids && b.item_ids.length > 0),
    { message: "item_ids required when scope=ids" },
  );

/**
 * POST /api/v1/merchant/menu/items/bulk-price
 *
 * Apply a single price adjustment to a slice of the menu in one shot, so
 * the merchant doesn't have to open + save 30 items individually when
 * "all pizzas go up by 5%" or "all sides drop to ₪12."
 *
 * Adjustment types:
 *   percent_increase   p% — newPrice = round(price * (1 + p/100))
 *   percent_decrease   p% — newPrice = round(price * (1 - p/100))
 *   fixed_add          ₪x — newPrice = price + x
 *   fixed_subtract     ₪x — newPrice = max(0, price - x)
 *   set                ₪x — newPrice = x   (overrides every selected item)
 *
 * Prices are integer shekels (NOT agorot) per the project convention. We
 * use Math.round for percent (banker's-friendly enough at this scale) and
 * never let a price go negative.
 */
export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = BulkPriceSchema.parse(await req.json());

  // Load the candidate items first so we can compute new prices and skip
  // anything from outside the tenant in one round-trip. updateMany() can't
  // do per-row math in Postgres without raw SQL, so we batch with a
  // transaction of single updates — fine for the ~500-item upper bound a
  // single tenant will hit.
  const where = {
    tenantId: session.tenantId,
    ...(body.scope === "category" && body.category_id
      ? { categoryId: body.category_id }
      : {}),
    ...(body.scope === "ids" && body.item_ids
      ? { id: { in: body.item_ids } }
      : {}),
  };
  const items = await prisma.menuItem.findMany({
    where,
    select: { id: true, basePrice: true },
  });

  if (items.length === 0) {
    return apiJson({ updated: 0, items: [] });
  }

  function computeNew(price: number): number {
    const a = body.adjustment;
    switch (a.type) {
      case "percent_increase":
        return Math.max(0, Math.round(price * (1 + a.value / 100)));
      case "percent_decrease":
        return Math.max(0, Math.round(price * (1 - a.value / 100)));
      case "fixed_add":
        return Math.max(0, price + Math.round(a.value));
      case "fixed_subtract":
        return Math.max(0, price - Math.round(a.value));
      case "set":
        return Math.max(0, Math.round(a.value));
    }
  }

  const updates = items.map((it) => ({
    id: it.id,
    oldPrice: it.basePrice,
    newPrice: computeNew(it.basePrice),
  }));

  // Skip no-op writes — useful when "+0%" was sent by accident or for items
  // where the math lands on the same integer.
  const real = updates.filter((u) => u.newPrice !== u.oldPrice);

  await prisma.$transaction(
    real.map((u) =>
      prisma.menuItem.update({
        where: { id: u.id },
        data: { basePrice: u.newPrice },
      }),
    ),
  );

  return apiJson({
    updated: real.length,
    skipped: updates.length - real.length,
    items: real.map((u) => ({ id: u.id, old_price: u.oldPrice, new_price: u.newPrice })),
  });
});
