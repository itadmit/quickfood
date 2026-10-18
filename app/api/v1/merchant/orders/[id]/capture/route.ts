import { after } from "next/server";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { getConfiguredProvider } from "@/lib/payments/factory";
import { recordOrderCommission } from "@/lib/billing-hub/commission";
import { PaymentStatus, PaymentTransactionStatus, type Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/merchant/orders/:id/capture
 *
 * Captures ("charge now") a J5 hold: the card was authorized and the amount
 * reserved at order time, and this moves the money for real. Only valid while
 * the order is in the `authorized` state. On success the order flips to paid
 * and the platform commission is recorded (it was deliberately NOT billed at
 * authorization time - a hold that's never captured must never be billed).
 *
 * Provider support is optional: only providers that implement `capture`
 * (currently Hyp) can do this. Everything else returns a clear error.
 */
export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId },
      select: {
        id: true,
        number: true,
        total: true,
        paymentStatus: true,
      },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

    if (order.paymentStatus === PaymentStatus.paid) {
      return apiError("conflict", "ההזמנה כבר חויבה", 409);
    }
    if (order.paymentStatus !== PaymentStatus.authorized) {
      return apiError("conflict", "אין הרשאת תשלום פתוחה לחיוב בהזמנה הזו", 409);
    }

    const auth = await prisma.paymentTransaction.findFirst({
      where: { orderId: id, status: PaymentTransactionStatus.authorized },
      orderBy: { createdAt: "desc" },
    });
    if (!auth) {
      return apiError("conflict", "לא נמצאה עסקת הרשאה לחיוב", 409);
    }

    const provider = await getConfiguredProvider(session.tenantId, auth.provider);
    if (!provider || typeof provider.capture !== "function") {
      return apiError(
        "capture_unsupported",
        "ספק הסליקה של ההזמנה לא תומך בגבייה מאוחרת דרך המערכת",
        400,
      );
    }

    const result = await provider.capture({
      providerTransactionId: auth.providerTransactionId,
      approvalNumber: auth.approvalNumber ?? undefined,
      providerToken: auth.providerToken ?? undefined,
      amount: auth.amount, // exactly what was authorized
      rawData: (auth.providerResponse ?? undefined) as Record<string, unknown> | undefined,
    });

    if (!result.success) {
      return apiError(
        "capture_failed",
        result.errorMessage || "גביית ההרשאה נכשלה בספק הסליקה",
        400,
      );
    }

    // The money moved at the provider - from here the order IS paid. Mark it
    // first (the source-of-truth), then do the bookkeeping best-effort so a
    // row-write hiccup can't leave the order stuck on `authorized` after a
    // real charge.
    const newTxnId = result.providerTransactionId || auth.providerTransactionId;
    await prisma.order.update({
      where: { id },
      data: { paymentStatus: PaymentStatus.paid, paymentIntentId: newTxnId },
    });

    // Record the capture as its own success transaction. Guard the unique
    // (provider, providerTransactionId) - if the provider echoed back the auth
    // id we'd collide with the existing auth row, so skip the insert then.
    if (newTxnId !== auth.providerTransactionId) {
      await prisma.paymentTransaction
        .create({
          data: {
            tenantId: session.tenantId,
            orderId: id,
            pendingPaymentId: auth.pendingPaymentId,
            provider: auth.provider,
            status: PaymentTransactionStatus.success,
            amount: auth.amount,
            currency: auth.currency,
            providerTransactionId: newTxnId,
            providerRequestId: auth.providerRequestId,
            providerToken: auth.providerToken,
            approvalNumber: result.approvalNumber ?? auth.approvalNumber,
            cardBrand: auth.cardBrand,
            cardLastFour: auth.cardLastFour,
            providerResponse: (result.rawData ?? {}) as Prisma.InputJsonValue,
          },
        })
        .catch((err) => console.error("[capture] transaction row insert failed", err));
    }

    await prisma.orderEvent.create({
      data: {
        orderId: id,
        type: "payment_captured",
        payload: {
          provider: auth.provider,
          amount: auth.amount,
          auth_transaction_id: auth.providerTransactionId,
          capture_transaction_id: newTxnId,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Commission was intentionally not billed at authorization - bill it now
    // that the money has actually moved.
    after(() =>
      recordOrderCommission(id).catch((err) =>
        console.error("[capture] commission record failed", err),
      ),
    );

    return apiJson({ ok: true, amount: auth.amount });
  },
);
