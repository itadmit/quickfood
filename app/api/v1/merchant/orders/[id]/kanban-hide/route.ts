/**
 * POST   /api/v1/merchant/orders/[id]/kanban-hide   - hide from Kanban
 * DELETE /api/v1/merchant/orders/[id]/kanban-hide   - restore to Kanban
 *
 * Stamps / clears Order.kanbanHiddenAt. The order itself is untouched -
 * status stays the same, billing stays the same, History keeps showing
 * it. Just a soft hide so the active-orders board doesn't carry stale
 * cards forever (timeouts, duplicates, walk-offs).
 */

import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant();
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, tenantId: true, kanbanHiddenAt: true },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
    if (session.role !== "platform_admin" && order.tenantId !== session.tenantId) {
      return apiError("forbidden", "אין הרשאה", 403);
    }
    if (order.kanbanHiddenAt) {
      return apiJson({ ok: true, already_hidden: true });
    }
    const updated = await prisma.order.update({
      where: { id },
      data: { kanbanHiddenAt: new Date() },
      select: { id: true, kanbanHiddenAt: true },
    });
    await prisma.orderEvent.create({
      data: {
        orderId: id,
        type: "kanban_hidden",
        payload: { hidden_at: updated.kanbanHiddenAt?.toISOString() ?? null },
      },
    });
    return apiJson({ ok: true, kanban_hidden_at: updated.kanbanHiddenAt });
  },
);

export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant();
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, tenantId: true, kanbanHiddenAt: true },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
    if (session.role !== "platform_admin" && order.tenantId !== session.tenantId) {
      return apiError("forbidden", "אין הרשאה", 403);
    }
    if (!order.kanbanHiddenAt) {
      return apiJson({ ok: true, already_visible: true });
    }
    await prisma.order.update({
      where: { id },
      data: { kanbanHiddenAt: null },
    });
    await prisma.orderEvent.create({
      data: {
        orderId: id,
        type: "kanban_restored",
        payload: { restored_at: new Date().toISOString() },
      },
    });
    return apiJson({ ok: true });
  },
);
