import { revalidateTag } from "next/cache";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { MenuItemInputSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const item = await prisma.menuItem.findUnique({
    where: { id },
    include: {
      sizes: { orderBy: { position: "asc" } },
      optionGroups: {
        orderBy: { position: "asc" },
        include: { options: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!item || item.tenantId !== session.tenantId) {
    return apiError("not_found", "פריט לא נמצא", 404);
  }
  return apiJson({
    item: {
      id: item.id,
      name: item.name,
      description: item.description,
      category_id: item.categoryId,
      base_price: item.basePrice,
      prep_minutes: item.prepMinutes,
      art_type: item.artType,
      image_url: item.imageUrl,
      images: item.images,
      available: item.available,
      tags: item.tags,
      sku: item.sku,
      available_from: item.availableFrom,
      available_to: item.availableTo,
      available_days: item.availableDays,
      stock_remaining: item.stockRemaining,
      sizes: item.sizes.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        price_delta: s.priceDelta,
        is_default: s.isDefault,
      })),
      option_groups: item.optionGroups.map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        required: g.required,
        min_select: g.minSelect,
        max_select: g.maxSelect,
        included_free: g.includedFree,
        help_text: g.helpText,
        template_set_id: g.templateSetId,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          price_delta: o.priceDelta,
          is_default: o.isDefault,
          available: o.available,
          image_url: o.imageUrl,
        })),
      })),
    },
  });
});

export const PUT = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = MenuItemInputSchema.parse(await req.json());

  const existing = await prisma.menuItem.findUnique({ where: { id }, select: { tenantId: true } });
  if (!existing) return apiError("not_found", "פריט לא נמצא", 404);
  if (existing.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);

  const cat = await prisma.menuCategory.findUnique({
    where: { id: body.category_id },
    select: { tenantId: true },
  });
  if (!cat || cat.tenantId !== session.tenantId) {
    return apiError("validation_error", "קטגוריה לא תקינה", 422, "category_id");
  }

  // Replace sizes + option groups (simple strategy)
  await prisma.$transaction([
    prisma.menuItem.update({
      where: { id },
      data: {
        categoryId: body.category_id,
        name: body.name,
        description: body.description,
        basePrice: body.base_price,
        prepMinutes: body.prep_minutes,
        artType: body.art_type,
        imageUrl: body.images[0] ?? body.image_url ?? null,
        images: body.images,
        available: body.available,
        tags: body.tags,
        position: body.position,
        sku: body.sku,
        availableFrom: body.available_from ?? null,
        availableTo: body.available_to ?? null,
        availableDays: body.available_days ?? null,
        stockRemaining: body.stock_remaining ?? null,
      },
    }),
    prisma.itemSize.deleteMany({ where: { itemId: id } }),
    prisma.itemOptionGroup.deleteMany({ where: { itemId: id } }),
    prisma.itemSize.createMany({
      data: body.sizes.map((s, i) => ({
        itemId: id,
        code: s.code,
        name: s.name,
        priceDelta: s.price_delta,
        isDefault: s.is_default,
        position: i,
      })),
    }),
  ]);

  // Re-create option groups with their options
  for (let gi = 0; gi < body.option_groups.length; gi++) {
    const g = body.option_groups[gi];
    await prisma.itemOptionGroup.create({
      data: {
        itemId: id,
        name: g.name,
        type: g.type,
        required: g.required,
        minSelect: g.min_select,
        maxSelect: g.max_select,
        includedFree: g.included_free,
        helpText: g.help_text ?? null,
        templateSetId: g.template_set_id ?? null,
        position: gi,
        options: {
          create: g.options.map((o, oi) => ({
            name: o.name,
            priceDelta: o.price_delta,
            isDefault: o.is_default,
            available: o.available,
            imageUrl: o.image_url ?? null,
            position: oi,
          })),
        },
      },
    });
  }

  revalidateTag(`menu-item-${id}`, {});
  return apiJson({ item: { id } });
});

export const DELETE = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const existing = await prisma.menuItem.findUnique({ where: { id }, select: { tenantId: true } });
  if (!existing) return apiError("not_found", "פריט לא נמצא", 404);
  if (existing.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);
  await prisma.menuItem.delete({ where: { id } });
  revalidateTag(`menu-item-${id}`, {});
  return apiJson({ ok: true });
});
