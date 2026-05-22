import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RefundSchema = z.object({
  reason: z.string().max(500).optional(),
  // If true, also cancel any pending kitchen state. For "already delivered
  // but customer complained" you'd skip this; for "ordered by mistake" it
  // makes sense.
  cancel_workflow: z.boolean().default(false),
});

/**
 * POST /api/v1/merchant/orders/:id/refund
 *
 * Marks the order as refunded server-side and fires an `order.refunded`
 * webhook so external POS / accounting can react. For CARD payments, the
 * actual money refund still needs to happen in the Grow Payments dashboard
 * — the merchant clicks "החזר תשלום" in Grow, then "סמן כהוחזר" here. We
 * don't auto-call Grow from this endpoint because Grow's refund API
 * requires their own auth handshake; keeping it manual avoids partial-
 * refund edge cases and makes the source-of-truth obvious (= Grow).
 *
 * For CASH payments the refund happens in real life; this endpoint just
 * records it.
 */
export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const body = RefundSchema.parse(await req.json().catch(() => ({})));

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId },
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        total: true,
      },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

    if (order.status === "refunded") {
      return apiError("conflict", "ההזמנה כבר סומנה כהוחזרה", 409);
    }

    await prisma.order.update({
      where: { id },
      data: {
        status: "refunded",
        paymentStatus: "refunded",
        cancelledAt: body.cancel_workflow ? new Date() : undefined,
      },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: id,
        type: "refunded",
        payload: {
          reason: body.reason ?? null,
          payment_method: order.paymentMethod,
          amount: order.total,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    void dispatchWebhook({
      tenantId: session.tenantId,
      eventType: "order.refunded",
      payload: {
        order_id: order.id,
        number: order.number,
        amount: order.total,
        payment_method: order.paymentMethod,
        reason: body.reason ?? null,
      },
    });

    return apiJson({
      ok: true,
      payment_method: order.paymentMethod,
      // Tell the UI what to display to the merchant about the money flow.
      money_action_required:
        order.paymentMethod !== "cash"
          ? "החזר את הסכום ידנית בלוח הבקרה של Grow Payments"
          : null,
    });
  },
);
