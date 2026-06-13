import { revalidateTag } from "next/cache";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { ModifierSetInputSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;

  const set = await prisma.modifierSet.findFirst({
    where: { id, tenantId: session.tenantId },
    include: {
      options: { orderBy: { position: "asc" } },
      _count: { select: { attachedTo: true } },
    },
  });
  if (!set) return apiError("not_found", "קטלוג לא נמצא", 404);

  return apiJson({
    set: {
      id: set.id,
      name: set.name,
      type: set.type,
      required: set.required,
      min_select: set.minSelect,
      max_select: set.maxSelect,
      included_free: set.includedFree,
      help_text: set.helpText,
      allow_half: set.allowHalf,
      split_price: set.splitPrice,
      bundle_count: set.bundleCount,
      bundle_price: set.bundlePrice,
      max_per_side: set.maxPerSide,
      position: set.position,
      attached_count: set._count.attachedTo,
      options: set.options.map((o) => ({
        id: o.id,
        name: o.name,
        price_delta: o.priceDelta,
        is_default: o.isDefault,
        available: o.available,
        image_url: o.imageUrl,
      })),
    },
  });
});

export const PUT = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = ModifierSetInputSchema.parse(await req.json());

  const existing = await prisma.modifierSet.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { id: true },
  });
  if (!existing) return apiError("not_found", "קטלוג לא נמצא", 404);

  const affectedItemIds = await prisma.$transaction(async (tx) => {
    await tx.modifierSet.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        required: body.required,
        minSelect: body.min_select,
        maxSelect: body.max_select,
        includedFree: body.included_free,
        helpText: body.help_text ?? null,
        allowHalf: body.allow_half,
        splitPrice: body.split_price,
        bundleCount: body.bundle_count,
        bundlePrice: body.bundle_price,
        maxPerSide: body.max_per_side ?? null,
        position: body.position,
      },
    });
    await tx.modifierSetOption.deleteMany({ where: { setId: id } });
    if (body.options.length > 0) {
      await tx.modifierSetOption.createMany({
        data: body.options.map((o, oi) => ({
          setId: id,
          name: o.name,
          priceDelta: o.price_delta,
          isDefault: o.is_default,
          available: o.available,
          imageUrl: o.image_url ?? null,
          position: oi,
        })),
      });
    }

    const attached = await tx.itemOptionGroup.findMany({
      where: { templateSetId: id },
      select: { id: true, itemId: true },
    });
    if (attached.length === 0) return [] as string[];

    await tx.itemOptionGroup.updateMany({
      where: { templateSetId: id },
      data: {
        name: body.name,
        type: body.type,
        required: body.required,
        minSelect: body.min_select,
        maxSelect: body.max_select,
        includedFree: body.included_free,
        helpText: body.help_text ?? null,
        allowHalf: body.allow_half,
        splitPrice: body.split_price,
        bundleCount: body.bundle_count,
        bundlePrice: body.bundle_price,
        maxPerSide: body.max_per_side ?? null,
      },
    });

    const groupIds = attached.map((g) => g.id);
    await tx.itemOption.deleteMany({ where: { groupId: { in: groupIds } } });
    if (body.options.length > 0) {
      await tx.itemOption.createMany({
        data: attached.flatMap((g) =>
          body.options.map((o, oi) => ({
            groupId: g.id,
            name: o.name,
            priceDelta: o.price_delta,
            isDefault: o.is_default,
            available: o.available,
            imageUrl: o.image_url ?? null,
            position: oi,
          })),
        ),
      });
    }
    return Array.from(new Set(attached.map((g) => g.itemId)));
  });

  for (const itemId of affectedItemIds) {
    revalidateTag(`menu-item-${itemId}`, {});
  }

  return apiJson({ set: { id } });
});

export const DELETE = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;

  const existing = await prisma.modifierSet.findFirst({
    where: { id, tenantId: session.tenantId },
    select: { id: true },
  });
  if (!existing) return apiError("not_found", "קטלוג לא נמצא", 404);

  // ItemOptionGroup.templateSetId is ON DELETE SET NULL - attached groups
  // become inline again but their inline options are preserved, so the
  // attached items keep working.
  const attached = await prisma.itemOptionGroup.findMany({
    where: { templateSetId: id },
    select: { itemId: true },
  });
  await prisma.modifierSet.delete({ where: { id } });
  const affectedItemIds = Array.from(new Set(attached.map((g) => g.itemId)));
  for (const itemId of affectedItemIds) {
    revalidateTag(`menu-item-${itemId}`, {});
  }
  return apiJson({ ok: true });
});
