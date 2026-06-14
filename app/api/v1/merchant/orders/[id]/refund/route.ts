import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { sendOrderCancelledEmail } from "@/lib/orders/notify-customer";
import { getConfiguredProvider } from "@/lib/payments/factory";
import { z } from "zod";
import { PaymentTransactionStatus, type Prisma } from "@prisma/client";

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
 * webhook so external POS / accounting can react. For CARD payments we call
 * the provider's refund API directly (Grow needs the original
 * transactionToken, stored on the charge transaction at payment time). If the
 * provider refund fails we abort and don't mark the order refunded, so the
 * money state stays truthful. If no provider/transaction is available we fall
 * back to recording the refund only (merchant settles manually in Grow).
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
        tip: true,
        cashCollected: true,
        courierId: true,
      },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

    if (order.status === "refunded") {
      return apiError("conflict", "ההזמנה כבר סומנה כהוחזרה", 409);
    }

    // For non-cash payments, perform the real money refund through the provider
    // API before recording anything. Grow requires the original transactionToken
    // (stored on the charge transaction). If the provider call fails we abort.
    let refundedViaProvider = false;
    if (order.paymentMethod !== "cash") {
      const txn = await prisma.paymentTransaction.findFirst({
        where: { orderId: id, status: PaymentTransactionStatus.success },
        orderBy: { createdAt: "desc" },
      });

      if (txn?.providerTransactionId) {
        const provider = await getConfiguredProvider(session.tenantId, txn.provider);
        if (provider) {
          const result = await provider.refund({
            providerTransactionId: txn.providerTransactionId,
            providerToken: txn.providerToken ?? undefined,
            amount: txn.amount, // exactly what the provider charged (symmetric to charge)
          });

          if (!result.success) {
            return apiError(
              "refund_failed",
              result.errorMessage || "החזר התשלום נכשל בספק התשלום",
              400,
            );
          }

          await prisma.paymentTransaction.update({
            where: { id: txn.id },
            data: { refundedAmount: txn.amount },
          });
          refundedViaProvider = true;
        }
      }
    }

    // If we're refunding an already-delivered order, the courier's
    // wallet got credited at delivery time - reverse exactly what
    // advanceStatus() added so the merchant doesn't pay the courier
    // for money the customer got back.
    let cashReverse = 0;
    let tipsOnHandReverse = 0;
    let tipsOwedReverse = 0;
    if (order.status === "delivered" && order.courierId) {
      if (order.paymentMethod === "cash") {
        const collected = order.cashCollected ?? order.total;
        tipsOnHandReverse = Math.min(order.tip, collected);
        cashReverse = Math.max(0, collected - order.tip);
      } else if (order.tip > 0) {
        tipsOwedReverse = order.tip;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: {
          status: "refunded",
          paymentStatus: "refunded",
          cancelledAt: body.cancel_workflow ? new Date() : undefined,
        },
      });

      if (order.courierId && (cashReverse || tipsOnHandReverse || tipsOwedReverse)) {
        await tx.courier.update({
          where: { id: order.courierId },
          data: {
            ...(cashReverse > 0 ? { cashOnHand: { decrement: cashReverse } } : {}),
            ...(tipsOnHandReverse > 0 ? { tipsOnHand: { decrement: tipsOnHandReverse } } : {}),
            ...(tipsOwedReverse > 0 ? { tipsOwed: { decrement: tipsOwedReverse } } : {}),
          },
        });
      }

      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: "refunded",
          payload: {
            reason: body.reason ?? null,
            payment_method: order.paymentMethod,
            amount: order.total,
            previous_status: order.status,
            courier_cash_reversed: cashReverse,
            courier_tips_on_hand_reversed: tipsOnHandReverse,
            courier_tips_owed_reversed: tipsOwedReverse,
          } as unknown as Prisma.InputJsonValue,
        },
      });
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

    void sendOrderCancelledEmail(order.id, { reason: body.reason ?? null }).catch((err) =>
      console.warn("[email] order cancelled failed", err),
    );

    return apiJson({
      ok: true,
      payment_method: order.paymentMethod,
      // Tell the UI what to display to the merchant about the money flow.
      money_action_required:
        order.paymentMethod !== "cash" && !refundedViaProvider
          ? "החזר את הסכום ידנית בלוח הבקרה של Grow Payments"
          : null,
    });
  },
);
