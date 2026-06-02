import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  bundle_price: z.number().int().min(1).max(10000).optional(),
  trigger_item_ids: z.array(z.string().uuid()).min(1).optional(),
  // Wolt model: existing combo menu item the suggestion points at.
  // Setting this to a value replaces the bundle's addon list; setting
  // it to null reverts to the legacy addon flow.
  linked_item_id: z.string().uuid().nullable().optional(),
  addon_items: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        qty: z.number().int().min(1).max(10).default(1),
      }),
    )
    .optional(),
  active: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  image_url: z.string().url().nullable().optional(),
  valid_from: z.string().datetime().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
});

async function ownBundle(id: string, tenantId: string) {
  const b = await prisma.bundleOffer.findUnique({ where: { id }, select: { tenantId: true } });
  return b && b.tenantId === tenantId ? b : null;
}

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    if (!(await ownBundle(id, session.tenantId))) {
      return apiError("not_found", "מבצע לא נמצא", 404);
    }
    const body = Patch.parse(await req.json());

    // Verify ownership of any new item references.
    const allNewIds = [
      ...(body.trigger_item_ids ?? []),
      ...(body.addon_items?.map((a) => a.item_id) ?? []),
      ...(body.linked_item_id ? [body.linked_item_id] : []),
    ];
    if (allNewIds.length > 0) {
      const owned = await prisma.menuItem.count({
        where: { id: { in: allNewIds }, tenantId: session.tenantId },
      });
      if (owned !== new Set(allNewIds).size) {
        return apiError("forbidden", "פריט אינו של המסעדה", 403);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.bundleOffer.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.image_url !== undefined && { imageUrl: body.image_url }),
          ...(body.bundle_price !== undefined && { bundlePrice: body.bundle_price }),
          ...(body.active !== undefined && { active: body.active }),
          ...(body.position !== undefined && { position: body.position }),
          ...(body.linked_item_id !== undefined && { linkedItemId: body.linked_item_id }),
          ...(body.valid_from !== undefined && {
            validFrom: body.valid_from ? new Date(body.valid_from) : null,
          }),
          ...(body.valid_until !== undefined && {
            validUntil: body.valid_until ? new Date(body.valid_until) : null,
          }),
        },
      });
      if (body.trigger_item_ids) {
        await tx.bundleOfferTrigger.deleteMany({ where: { bundleId: id } });
        await tx.bundleOfferTrigger.createMany({
          data: body.trigger_item_ids.map((itemId) => ({ bundleId: id, itemId })),
        });
      }
      if (body.addon_items) {
        await tx.bundleOfferAddon.deleteMany({ where: { bundleId: id } });
        await tx.bundleOfferAddon.createMany({
          data: body.addon_items.map((a) => ({ bundleId: id, itemId: a.item_id, qty: a.qty })),
        });
      }
    });
    return apiJson({ ok: true });
  },
);

export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    if (!(await ownBundle(id, session.tenantId))) {
      return apiError("not_found", "מבצע לא נמצא", 404);
    }
    await prisma.bundleOffer.delete({ where: { id } });
    return apiJson({ ok: true });
  },
);
