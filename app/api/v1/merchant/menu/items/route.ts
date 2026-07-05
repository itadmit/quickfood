import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { MenuItemInputSchema } from "@/lib/validate";
import { resolveGroupOptions } from "@/lib/menu-item-options";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) {
    return apiJson({ items: [], meta: { total: 0, page: 1, per_page: 0 } });
  }
  const url = new URL(req.url);
  const categoryId = url.searchParams.get("category_id");
  const availableParam = url.searchParams.get("available");
  const q = url.searchParams.get("q");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const perPage = Math.min(200, Math.max(1, parseInt(url.searchParams.get("per_page") || "50", 10)));

  const where: Prisma.MenuItemWhereInput = { tenantId: session.tenantId };
  if (categoryId) where.categoryId = categoryId;
  if (availableParam === "true") where.available = true;
  else if (availableParam === "false") where.available = false;
  if (q) where.name = { contains: q, mode: "insensitive" };

  const [items, total] = await Promise.all([
    prisma.menuItem.findMany({
      where,
      include: {
        sizes: { orderBy: { position: "asc" } },
        optionGroups: {
          orderBy: { position: "asc" },
          include: { options: { orderBy: { position: "asc" } } },
        },
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.menuItem.count({ where }),
  ]);

  return apiJson({
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category_id: item.categoryId,
      base_price: item.basePrice,
      prep_minutes: item.prepMinutes,
      art_type: item.artType,
      image_url: item.imageUrl,
      images: item.images,
      image_note: item.imageNote,
      available: item.available,
      tags: item.tags,
      position: item.position,
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
    })),
    meta: { total, page, per_page: perPage },
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = MenuItemInputSchema.parse(await req.json());

  // Verify category belongs to tenant
  const cat = await prisma.menuCategory.findUnique({
    where: { id: body.category_id },
    select: { tenantId: true },
  });
  if (!cat || cat.tenantId !== session.tenantId) {
    return apiError("validation_error", "קטגוריה לא תקינה", 422, "category_id");
  }

  const resolveOptions = await resolveGroupOptions(body.option_groups);

  const item = await prisma.menuItem.create({
    data: {
      tenantId: session.tenantId,
      categoryId: body.category_id,
      name: body.name,
      description: body.description,
      basePrice: body.base_price,
      prepMinutes: body.prep_minutes,
      artType: body.art_type,
      imageUrl: body.images[0] ?? body.image_url ?? null,
      images: body.images,
      imageNote: body.image_note ?? null,
      available: body.available,
      tags: body.tags,
      position: body.position,
      sku: body.sku,
      availableFrom: body.available_from ?? null,
      availableTo: body.available_to ?? null,
      availableDays: body.available_days ?? null,
      stockRemaining: body.stock_remaining ?? null,
      sizes: {
        create: body.sizes.map((s, i) => ({
          code: s.code,
          name: s.name,
          priceDelta: s.price_delta,
          isDefault: s.is_default,
          position: i,
        })),
      },
      optionGroups: {
        create: body.option_groups.map((g, gi) => ({
          name: g.name,
          type: g.type,
          required: g.required,
          minSelect: g.min_select,
          maxSelect: g.max_select,
          includedFree: g.included_free,
          helpText: g.help_text ?? null,
          allowHalf: g.allow_half,
          splitPrice: g.split_price,
          customHalfPrice: g.custom_half_price,
          bundleCount: g.bundle_count,
          bundlePrice: g.bundle_price,
          maxPerSide: g.max_per_side ?? null,
          templateSetId: g.template_set_id ?? null,
          position: gi,
          options: {
            create: resolveOptions(g).map((o, oi) => ({
              ...o,
              position: oi,
            })),
          },
        })),
      },
    },
  });

  return apiJson({ item: { id: item.id, name: item.name } }, 201);
});
