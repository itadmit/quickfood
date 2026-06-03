import { revalidateTag } from "next/cache";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReorderSchema = z.object({
  // Item ids in the desired display order. Each item's `position` is set to
  // its index in this array. Callers pass a single category's items so the
  // positions stay scoped per-category (the storefront orders by
  // [categoryId, position]).
  item_ids: z.array(z.string().uuid()).min(1).max(1000),
});

/**
 * POST /api/v1/merchant/menu/items/reorder
 *
 * Persist a drag-to-reorder of menu items. Writes position = index for each
 * id in `item_ids`. All ids must belong to the caller's tenant.
 */
export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const { item_ids } = ReorderSchema.parse(await req.json());

  // Reject duplicates — a duplicated id would make positions ambiguous.
  if (new Set(item_ids).size !== item_ids.length) {
    return apiError("validation_error", "רשימת הפריטים מכילה כפילויות", 422);
  }

  // Ownership check: every id must be a menu item of this tenant. Prevents
  // writing position onto another restaurant's items.
  const owned = await prisma.menuItem.findMany({
    where: { id: { in: item_ids }, tenantId: session.tenantId },
    select: { id: true },
  });
  if (owned.length !== item_ids.length) {
    return apiError("invalid_items", "חלק מהפריטים אינם שייכים למסעדה", 422);
  }

  await prisma.$transaction(
    item_ids.map((id, index) =>
      prisma.menuItem.update({ where: { id }, data: { position: index } }),
    ),
  );

  for (const id of item_ids) revalidateTag(`menu-item-${id}`, {});

  return apiJson({ ok: true, count: item_ids.length });
});
