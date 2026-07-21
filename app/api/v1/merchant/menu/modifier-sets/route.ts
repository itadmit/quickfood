import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { ModifierSetInputSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const sets = await prisma.modifierSet.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      options: { orderBy: { position: "asc" } },
      _count: { select: { attachedTo: true } },
    },
  });

  return apiJson({
    sets: sets.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      required: s.required,
      min_select: s.minSelect,
      max_select: s.maxSelect,
      included_free: s.includedFree,
      help_text: s.helpText,
      allow_half: s.allowHalf,
      allow_qty: s.allowQty,
      split_price: s.splitPrice,
      custom_half_price: s.customHalfPrice,
      bundle_count: s.bundleCount,
      bundle_price: s.bundlePrice,
      max_per_side: s.maxPerSide,
      position: s.position,
      attached_count: s._count.attachedTo,
      options: s.options.map((o) => ({
        id: o.id,
        name: o.name,
        price_delta: o.priceDelta,
        half_price_delta: o.halfPriceDelta,
        is_default: o.isDefault,
        available: o.available,
        image_url: o.imageUrl,
        max_quantity: o.maxQuantity,
      })),
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = ModifierSetInputSchema.parse(await req.json());

  const set = await prisma.modifierSet.create({
    data: {
      tenantId: session.tenantId,
      name: body.name,
      type: body.type,
      required: body.required,
      minSelect: body.min_select,
      maxSelect: body.max_select,
      includedFree: body.included_free,
      helpText: body.help_text ?? null,
      allowHalf: body.allow_half,
      allowQty: body.allow_qty,
      splitPrice: body.split_price,
      customHalfPrice: body.custom_half_price,
      bundleCount: body.bundle_count,
      bundlePrice: body.bundle_price,
      maxPerSide: body.max_per_side ?? null,
      position: body.position,
      options: {
        create: body.options.map((o, oi) => ({
          name: o.name,
          priceDelta: o.price_delta,
          halfPriceDelta: o.half_price_delta ?? null,
          isDefault: o.is_default,
          available: o.available,
          imageUrl: o.image_url ?? null,
          maxQuantity: o.max_quantity,
          position: oi,
        })),
      },
    },
  });

  return apiJson({ set: { id: set.id, name: set.name } }, 201);
});
