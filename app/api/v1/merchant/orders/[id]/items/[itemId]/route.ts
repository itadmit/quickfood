import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Editing is allowed until the order has left the kitchen. Once a
// courier picks it up (or it's been delivered/cancelled/refunded), the
// money + dispatch + commission have all settled and silently
// recomputing totals would diverge from what was actually charged /
// what the courier has in hand.
const EDITABLE_STATUSES = new Set(["pending", "confirmed", "preparing", "in_oven", "ready"]);

const PatchBody = z.object({
  quantity: z.number().int().min(1).max(20).optional(),
  notes: z.string().max(500).nullable().optional(),
});

// loadAndAuthorize throws the apiError Response on any guard failure —
// the route handler wrapper at lib/api-response.ts catches Response
// throws and returns them as-is, so this keeps the call sites flat.
async function loadAndAuthorize(
  orderId: string,
  itemId: string,
  tenantId: string,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    select: {
      id: true,
      number: true,
      status: true,
      tenantId: true,
      deliveryFee: true,
      serviceFee: true,
      cutleryFee: true,
      tip: true,
      discount: true,
      items: {
        select: { id: true, unitPrice: true, totalPrice: true, quantity: true, nameSnapshot: true },
      },
    },
  });
  if (!order) throw apiError("not_found", "הזמנה לא נמצאה", 404);
  if (!EDITABLE_STATUSES.has(order.status)) {
    throw apiError(
      "not_editable",
      "אי אפשר לערוך הזמנה אחרי שיצאה למשלוח / נמסרה / בוטלה",
      409,
    );
  }
  const item = order.items.find((it) => it.id === itemId);
  if (!item) throw apiError("not_found", "הפריט לא נמצא בהזמנה", 404);
  return { order, item };
}

function newTotals(
  order: { deliveryFee: number; serviceFee: number; cutleryFee: number; tip: number; discount: number },
  newSubtotal: number,
) {
  const total =
    newSubtotal +
    order.deliveryFee +
    order.serviceFee +
    order.cutleryFee +
    order.tip -
    order.discount;
  return { subtotal: newSubtotal, total: Math.max(0, total) };
}

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id, itemId } = await params;

    const body = PatchBody.parse(await req.json());
    if (body.quantity === undefined && body.notes === undefined) {
      return apiError("validation_error", "אין מה לעדכן", 400);
    }

    const { order, item } = await loadAndAuthorize(id, itemId, session.tenantId);

    const nextQty = body.quantity ?? item.quantity;
    const nextItemTotal = item.unitPrice * nextQty;
    const newSubtotal = order.items.reduce(
      (acc, it) => acc + (it.id === itemId ? nextItemTotal : it.totalPrice),
      0,
    );
    const totals = newTotals(order, newSubtotal);

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          ...(body.quantity !== undefined ? { quantity: nextQty, totalPrice: nextItemTotal } : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
        },
      });
      await tx.order.update({
        where: { id },
        data: { subtotal: totals.subtotal, total: totals.total },
      });
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: "items_edited",
          payload: {
            edited_by: session.userId,
            item_id: itemId,
            item_name: item.nameSnapshot,
            action: "update",
            quantity: body.quantity ?? null,
            notes_changed: body.notes !== undefined,
            new_subtotal: totals.subtotal,
            new_total: totals.total,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    void dispatchWebhook({
      tenantId: order.tenantId,
      eventType: "order.items_edited",
      payload: { order_id: id, item_id: itemId, action: "update" },
    });

    return apiJson({ ok: true, subtotal: totals.subtotal, total: totals.total });
  },
);

export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id, itemId } = await params;

    const { order, item } = await loadAndAuthorize(id, itemId, session.tenantId);

    if (order.items.length <= 1) {
      return apiError(
        "validation_error",
        "אי אפשר למחוק את הפריט האחרון בהזמנה — עדיף לבטל את ההזמנה",
        409,
      );
    }

    const newSubtotal = order.items.reduce(
      (acc, it) => acc + (it.id === itemId ? 0 : it.totalPrice),
      0,
    );
    const totals = newTotals(order, newSubtotal);

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: itemId } });
      await tx.order.update({
        where: { id },
        data: { subtotal: totals.subtotal, total: totals.total },
      });
      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: "items_edited",
          payload: {
            edited_by: session.userId,
            item_id: itemId,
            item_name: item.nameSnapshot,
            action: "remove",
            new_subtotal: totals.subtotal,
            new_total: totals.total,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    });

    void dispatchWebhook({
      tenantId: order.tenantId,
      eventType: "order.items_edited",
      payload: { order_id: id, item_id: itemId, action: "remove" },
    });

    return apiJson({ ok: true, subtotal: totals.subtotal, total: totals.total });
  },
);
