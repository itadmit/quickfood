import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { deletePrefix } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner has to echo this exact string in the request body. A naked
// DELETE call (or a bug that fires the action with a wrong payload)
// can't accidentally wipe an entire menu.
const CONFIRM_TOKEN = "DELETE_ALL_ITEMS";

const BodySchema = z.object({
  confirm: z.literal(CONFIRM_TOKEN),
});

/**
 * POST /api/v1/merchant/menu/items/bulk-delete
 *
 * Wipes every MenuItem for the calling tenant. Used from
 * Advanced settings as the "undo a bad Wolt import" escape hatch.
 *
 * Cascades worth knowing about:
 *   • ItemSize, ItemOptionGroup, Favorite — DB cascade, gone.
 *   • OrderItem.menuItemId is optional → set NULL by Prisma defaults.
 *     The nameSnapshot/unitPrice on each line keeps order history
 *     readable after the items themselves are gone.
 *   • CartItem.menuItemId has no FK constraint (loose link) — rows
 *     stay; they'll be cleared the next time the carts expire.
 *   • MenuCategory and ModifierSet are NOT touched. Empty categories
 *     are harmless and re-importing from Wolt upserts back into them.
 */
export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return apiError("bad_confirm", "אישור המחיקה לא תקין", 400);
  }

  const result = await prisma.menuItem.deleteMany({
    where: { tenantId: session.tenantId },
  });

  // Sweep R2 for the tenant's uploaded menu images so the bucket
  // doesn't accumulate orphaned bytes. Wolt imports live under a
  // separate prefix and could include things we don't want to delete
  // here (e.g. logo/cover), so we deliberately scope to the direct-
  // upload bucket prefix `{tenantId}/menu/`. Failures are non-fatal.
  let r2Deleted = 0;
  let r2Errors = 0;
  try {
    const res = await deletePrefix(`${session.tenantId}/menu/`);
    r2Deleted = res.deleted;
    r2Errors = res.errors;
  } catch {
    // best-effort
  }

  return apiJson({
    deleted: result.count,
    r2: { deleted: r2Deleted, errors: r2Errors },
  });
});
