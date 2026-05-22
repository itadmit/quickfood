import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { MenuItemInputSchema } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      available: body.available,
      tags: body.tags,
      position: body.position,
      sku: body.sku,
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
          templateSetId: g.template_set_id ?? null,
          position: gi,
          options: {
            // Inline options are ignored at runtime when templateSetId is set,
            // but we still persist them so that detaching the set later keeps
            // the merchant's previous inline rows around.
            create: g.options.map((o, oi) => ({
              name: o.name,
              priceDelta: o.price_delta,
              isDefault: o.is_default,
              available: o.available,
              position: oi,
            })),
          },
        })),
      },
    },
  });

  return apiJson({ item: { id: item.id, name: item.name } }, 201);
});
