import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReorderSchema = z.object({
  category_ids: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * POST /api/v1/merchant/menu/categories/reorder
 *
 * Persist drag-to-reorder of menu categories. Writes position = index for
 * each id in `category_ids`. All ids must belong to the caller's tenant.
 */
export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const { category_ids } = ReorderSchema.parse(await req.json());

  if (new Set(category_ids).size !== category_ids.length) {
    return apiError("validation_error", "רשימת הקטגוריות מכילה כפילויות", 422);
  }

  const owned = await prisma.menuCategory.findMany({
    where: { id: { in: category_ids }, tenantId: session.tenantId },
    select: { id: true },
  });
  if (owned.length !== category_ids.length) {
    return apiError("invalid_categories", "חלק מהקטגוריות אינן שייכות למסעדה", 422);
  }

  await prisma.$transaction(
    category_ids.map((id, index) =>
      prisma.menuCategory.update({ where: { id }, data: { position: index } }),
    ),
  );

  return apiJson({ ok: true, count: category_ids.length });
});
