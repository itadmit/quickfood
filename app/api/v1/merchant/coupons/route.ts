import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CouponInputSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/, {
    message: "קוד יכול להכיל רק אותיות באנגלית, ספרות, - או _",
  }),
  description: z.string().max(200).default(""),
  type: z.enum(["percent", "fixed"]).default("percent"),
  value: z.number().int().min(1).max(10000),
  min_order: z.number().int().min(0).nullable().optional(),
  max_discount: z.number().int().min(0).nullable().optional(),
  usage_limit: z.number().int().min(1).nullable().optional(),
  per_customer_limit: z.number().int().min(1).nullable().optional(),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  active: z.boolean().default(true),
  applies_to: z.enum(["all", "category", "items"]).default("all"),
  category_id: z.string().uuid().nullable().optional(),
  item_ids: z.array(z.string().uuid()).default([]),
});

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const coupons = await prisma.coupon.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ active: "desc" }, { validFrom: "desc" }],
  });

  return apiJson({
    coupons: coupons.map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value,
      min_order: c.minOrder,
      max_discount: c.maxDiscount,
      usage_limit: c.usageLimit,
      usage_count: c.usageCount,
      per_customer_limit: c.perCustomerLimit,
      valid_from: c.validFrom.toISOString(),
      valid_until: c.validUntil?.toISOString() ?? null,
      active: c.active,
      applies_to: c.appliesTo,
      category_id: c.categoryId,
      item_ids: c.itemIds,
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = CouponInputSchema.parse(await req.json());

  // Uniqueness check via the (tenantId, code) compound unique index.
  const existing = await prisma.coupon.findFirst({
    where: { tenantId: session.tenantId, code: body.code },
    select: { id: true },
  });
  if (existing) {
    return apiError("validation_error", "קוד כבר קיים - בחר אחר", 422, "code");
  }

  // If targeting a single category, sanity-check it belongs to the tenant.
  if (body.applies_to === "category" && body.category_id) {
    const cat = await prisma.menuCategory.findFirst({
      where: { id: body.category_id, tenantId: session.tenantId },
      select: { id: true },
    });
    if (!cat) {
      return apiError("validation_error", "קטגוריה לא תקפה", 422, "category_id");
    }
  }

  const coupon = await prisma.coupon.create({
    data: {
      tenantId: session.tenantId,
      code: body.code,
      description: body.description,
      type: body.type,
      value: body.value,
      minOrder: body.min_order ?? null,
      maxDiscount: body.max_discount ?? null,
      usageLimit: body.usage_limit ?? null,
      perCustomerLimit: body.per_customer_limit ?? null,
      validFrom: body.valid_from ? new Date(body.valid_from) : undefined,
      validUntil: body.valid_until ? new Date(body.valid_until) : null,
      active: body.active,
      appliesTo: body.applies_to,
      categoryId: body.applies_to === "category" ? (body.category_id ?? null) : null,
      itemIds: body.applies_to === "items" ? body.item_ids : [],
    },
  });

  return apiJson({ coupon: { id: coupon.id, code: coupon.code } }, 201);
});
