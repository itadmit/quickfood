import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CouponPatchSchema = z
  .object({
    description: z.string().max(200).optional(),
    type: z.enum(["percent", "fixed"]).optional(),
    value: z.number().int().min(1).max(10000).optional(),
    min_order: z.number().int().min(0).nullable().optional(),
    max_discount: z.number().int().min(0).nullable().optional(),
    usage_limit: z.number().int().min(1).nullable().optional(),
    per_customer_limit: z.number().int().min(1).nullable().optional(),
    valid_from: z.string().datetime().optional(),
    valid_until: z.string().datetime().nullable().optional(),
    active: z.boolean().optional(),
    applies_to: z.enum(["all", "category", "items"]).optional(),
    category_id: z.string().uuid().nullable().optional(),
    item_ids: z.array(z.string().uuid()).optional(),
  })
  .strict();

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const body = CouponPatchSchema.parse(await req.json());

    const existing = await prisma.coupon.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true },
    });
    if (!existing) return apiError("not_found", "קופון לא נמצא", 404);

    const updated = await prisma.coupon.update({
      where: { id },
      data: {
        ...(body.description !== undefined && { description: body.description }),
        ...(body.type && { type: body.type }),
        ...(body.value !== undefined && { value: body.value }),
        ...(body.min_order !== undefined && { minOrder: body.min_order }),
        ...(body.max_discount !== undefined && { maxDiscount: body.max_discount }),
        ...(body.usage_limit !== undefined && { usageLimit: body.usage_limit }),
        ...(body.per_customer_limit !== undefined && {
          perCustomerLimit: body.per_customer_limit,
        }),
        ...(body.valid_from && { validFrom: new Date(body.valid_from) }),
        ...(body.valid_until !== undefined && {
          validUntil: body.valid_until ? new Date(body.valid_until) : null,
        }),
        ...(body.active !== undefined && { active: body.active }),
        ...(body.applies_to && { appliesTo: body.applies_to }),
        ...(body.category_id !== undefined && { categoryId: body.category_id }),
        ...(body.item_ids && { itemIds: body.item_ids }),
      },
    });

    return apiJson({ coupon: { id: updated.id } });
  },
);

export const DELETE = handler(
  async (_req, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;

    const existing = await prisma.coupon.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true },
    });
    if (!existing) return apiError("not_found", "קופון לא נמצא", 404);

    await prisma.coupon.delete({ where: { id } });
    return apiJson({ ok: true });
  },
);
