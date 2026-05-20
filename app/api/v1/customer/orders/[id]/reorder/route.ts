import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { rebuildCartFromOrder } from "@/lib/order-reorder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Convert a past order into a fresh set of cart lines using *current*
 * pricing and availability. Returns:
 *   - `lines`  : items the client should add to the cart now
 *   - `issues` : items that couldn't be restored (removed, hidden, size
 *                gone, or an option gone). The client renders these in
 *                a warning modal.
 *
 * Access rules mirror /api/v1/customer/orders/[id]:
 *   - Logged-in customer: must own the order.
 *   - Guest: knowledge of the order id (UUIDv4) is sufficient.
 */
export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, customerId: true, tenantId: true },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

    const session = await getSession();
    if (
      session?.type === "customer" &&
      order.customerId &&
      order.customerId !== session.userId
    ) {
      return apiError("forbidden", "אין הרשאה לשחזר הזמנה זו", 403);
    }

    const result = await rebuildCartFromOrder(order.id);
    return apiJson(result);
  },
);
