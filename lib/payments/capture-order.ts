/**
 * Shared J5 "charge now" capture, used by both result paths:
 *   - POST /api/v1/merchant/orders/:id/capture   (manual "חייב עכשיו" button)
 *   - PATCH .../status                            (capture-on-approval mode:
 *                                                  the merchant accepting the
 *                                                  order triggers the charge)
 *
 * Captures a prior J5 hold: the card was authorized and the amount reserved at
 * order time, and this moves the money for real. Only valid while the order is
 * in the `authorized` state. On success the order flips to paid and the
 * platform commission is recorded (deliberately NOT billed at authorization - a
 * hold that's never captured must never be billed).
 */

import { after } from "next/server";
import { prisma } from "@/lib/db/client";
import { getConfiguredProvider } from "@/lib/payments/factory";
import { recordOrderCommission } from "@/lib/billing-hub/commission";
import { PaymentStatus, PaymentTransactionStatus, type Prisma } from "@prisma/client";

export type CaptureOrderResult =
  | { ok: true; amount: number; alreadyPaid?: boolean }
  | {
      ok: false;
      code: "not_found" | "already_paid" | "not_authorized" | "no_auth_txn" | "unsupported" | "capture_failed";
      message: string;
    };

export async function captureOrder({
  orderId,
  tenantId,
}: {
  orderId: string;
  tenantId: string;
}): Promise<CaptureOrderResult> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    select: { id: true, number: true, total: true, paymentStatus: true },
  });
  if (!order) return { ok: false, code: "not_found", message: "הזמנה לא נמצאה" };

  if (order.paymentStatus === PaymentStatus.paid) {
    return { ok: false, code: "already_paid", message: "ההזמנה כבר חויבה" };
  }
  if (order.paymentStatus !== PaymentStatus.authorized) {
    return {
      ok: false,
      code: "not_authorized",
      message: "אין הרשאת תשלום פתוחה לחיוב בהזמנה הזו",
    };
  }

  const auth = await prisma.paymentTransaction.findFirst({
    where: { orderId, status: PaymentTransactionStatus.authorized },
    orderBy: { createdAt: "desc" },
  });
  if (!auth) {
    return { ok: false, code: "no_auth_txn", message: "לא נמצאה עסקת הרשאה לחיוב" };
  }

  const provider = await getConfiguredProvider(tenantId, auth.provider);
  if (!provider || typeof provider.capture !== "function") {
    return {
      ok: false,
      code: "unsupported",
      message: "ספק הסליקה של ההזמנה לא תומך בגבייה מאוחרת דרך המערכת",
    };
  }

  const result = await provider.capture({
    providerTransactionId: auth.providerTransactionId,
    approvalNumber: auth.approvalNumber ?? undefined,
    providerToken: auth.providerToken ?? undefined,
    amount: auth.amount, // exactly what was authorized
    rawData: (auth.providerResponse ?? undefined) as Record<string, unknown> | undefined,
  });

  if (!result.success) {
    return {
      ok: false,
      code: "capture_failed",
      message: result.errorMessage || "גביית ההרשאה נכשלה בספק הסליקה",
    };
  }

  // The money moved at the provider - from here the order IS paid. Mark it
  // first (the source-of-truth), then do the bookkeeping best-effort so a
  // row-write hiccup can't leave the order stuck on `authorized` after a
  // real charge.
  const newTxnId = result.providerTransactionId || auth.providerTransactionId;
  await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: PaymentStatus.paid, paymentIntentId: newTxnId },
  });

  // Record the capture as its own success transaction. Guard the unique
  // (provider, providerTransactionId) - if the provider echoed back the auth
  // id we'd collide with the existing auth row, so skip the insert then.
  if (newTxnId !== auth.providerTransactionId) {
    await prisma.paymentTransaction
      .create({
        data: {
          tenantId,
          orderId,
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
      orderId,
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
    recordOrderCommission(orderId).catch((err) =>
      console.error("[capture] commission record failed", err),
    ),
  );

  return { ok: true, amount: auth.amount };
}
