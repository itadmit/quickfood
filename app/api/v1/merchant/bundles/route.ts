import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Input = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  bundle_price: z.number().int().min(1).max(10000),
  trigger_item_ids: z.array(z.string().uuid()).min(1),
  addon_items: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        qty: z.number().int().min(1).max(10).default(1),
      }),
    )
    .min(1),
  active: z.boolean().default(true),
  position: z.number().int().min(0).default(0),
  image_url: z.string().url().nullable().optional(),
  valid_from: z.string().datetime().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
});

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const bundles = await prisma.bundleOffer.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      triggers: { include: { item: { select: { id: true, name: true } } } },
      addons: { include: { item: { select: { id: true, name: true, basePrice: true } } } },
    },
  });
  return apiJson({
    bundles: bundles.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      bundle_price: b.bundlePrice,
      active: b.active,
      position: b.position,
      image_url: b.imageUrl,
      valid_from: b.validFrom?.toISOString() ?? null,
      valid_until: b.validUntil?.toISOString() ?? null,
      trigger_items: b.triggers.map((t) => ({ id: t.itemId, name: t.item.name })),
      addon_items: b.addons.map((a) => ({
        id: a.itemId,
        name: a.item.name,
        base_price: a.item.basePrice,
        qty: a.qty,
      })),
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Input.parse(await req.json());

  // All referenced items must belong to the same tenant — otherwise a
  // merchant could craft a bundle that triggers off another shop's
  // pizza and pulls in their drinks.
  const allIds = [
    ...body.trigger_item_ids,
    ...body.addon_items.map((a) => a.item_id),
  ];
  const owned = await prisma.menuItem.count({
    where: { id: { in: allIds }, tenantId: session.tenantId },
  });
  if (owned !== new Set(allIds).size) {
    return apiError("forbidden", "פריט אינו של המסעדה", 403);
  }

  const created = await prisma.bundleOffer.create({
    data: {
      tenantId: session.tenantId,
      name: body.name,
      description: body.description,
      imageUrl: body.image_url,
      bundlePrice: body.bundle_price,
      active: body.active,
      position: body.position,
      validFrom: body.valid_from ? new Date(body.valid_from) : null,
      validUntil: body.valid_until ? new Date(body.valid_until) : null,
      triggers: {
        create: body.trigger_item_ids.map((itemId) => ({ itemId })),
      },
      addons: {
        create: body.addon_items.map((a) => ({ itemId: a.item_id, qty: a.qty })),
      },
    },
    select: { id: true },
  });
  return apiJson({ bundle: { id: created.id } }, 201);
});
