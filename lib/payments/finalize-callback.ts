/**
 * Shared post-payment finalization, used by every provider result path:
 *   - POST /api/payments/callback          (Grow + CardCom server-to-server)
 *   - GET|POST /api/payments/hyp/return    (Hyp browser redirect - no S2S webhook)
 *
 * Takes an ALREADY-VERIFIED ParsedCallback (each provider establishes
 * authenticity in its own parseCallback/validateWebhook) and does the rest:
 * match the pending payment or kiosk checkout, sanity-check the amount, write
 * the transaction, flip the order to paid, advance its status, record the
 * commission and print the ticket.
 *
 * Idempotent: re-processing the same result is a no-op (so Grow's retries and
 * a customer refreshing Hyp's return URL are both safe).
 */

import { after } from "next/server";
import { prisma } from "@/lib/db/client";
import { advanceStatus, canTransition } from "@/lib/orders";
import { printOrderTicket } from "@/lib/printing/print-order";
import { checkoutRefToId, materializeKioskCheckout } from "@/lib/orders/kiosk-checkout";
import { recordOrderCommission } from "@/lib/billing-hub/commission";
import { alertMerchantNewOrder } from "@/lib/orders/notify-merchant";
import { publishOrderCreated } from "@/lib/realtime/worker";
import type { IPaymentProvider, ParsedCallback, TransactionStatus } from "./types";
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus,
  PendingPaymentStatus,
} from "@prisma/client";

export interface FinalizeCallbackResult {
  /** Did we find the pending payment / kiosk checkout this result belongs to? */
  matched: boolean;
  /** Which flow the reference resolved to. */
  kind: "order" | "kiosk" | "none";
  /** The order this settled against, once one exists. */
  orderId: string | null;
  status: TransactionStatus;
  /** Set when the result was rejected rather than applied. */
  error?: "amount_mismatch" | "materialize_failed" | "checkout_not_found";
}

/**
 * Advance pending -> confirmed (fires webhooks) and bill the commission, but
 * only when the transition is legal. The commission used to fire
 * unconditionally, including for orders the merchant had already cancelled
 * while the callback was in flight - which billed them for cash they never got.
 */
async function confirmAndBill(
  orderId: string,
  logPrefix: string,
  // A J5 hold confirms the order (so the kitchen works) but must NOT bill the
  // commission yet - that happens at capture, when the money actually moves.
  { bill = true }: { bill?: boolean } = {},
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!order || !canTransition(order.status, OrderStatus.confirmed)) return;

  try {
    await advanceStatus(orderId, OrderStatus.confirmed, {
      changedBy: "payment_callback",
      reason: bill ? "payment_received" : "payment_authorized",
    });
  } catch (err) {
    console.error(`${logPrefix} advanceStatus failed`, err);
    return;
  }

  if (!bill) return;

  void recordOrderCommission(orderId).catch((err) => {
    console.error(`${logPrefix} commission record failed`, err);
  });
}

export async function finalizeProviderCallback({
  tenant,
  providerType,
  provider,
  parsed,
  logPrefix = "[payments/callback]",
}: {
  tenant: { id: string; slug: string };
  providerType: PaymentProvider;
  provider: IPaymentProvider;
  parsed: ParsedCallback;
  logPrefix?: string;
}): Promise<FinalizeCallbackResult> {
  // ── Kiosk-card pre-checkout branch ────────────────────────────────────
  // If the reference the provider echoed back is a checkout ref (KCO- prefix)
  // the Order doesn't exist yet - materialize it from the cart snapshot, then
  // run the normal finalization against the freshly-created order.
  const checkoutId = checkoutRefToId(parsed.orderReference);
  if (checkoutId) {
    const checkout = await prisma.kioskPendingCheckout.findUnique({
      where: { id: checkoutId },
      select: { id: true, tenantId: true, amount: true, status: true, orderId: true },
    });
    if (!checkout || checkout.tenantId !== tenant.id) {
      console.warn(`${logPrefix} kiosk checkout not found`, { checkoutId });
      return {
        matched: false,
        kind: "kiosk",
        orderId: null,
        status: parsed.status,
        error: "checkout_not_found",
      };
    }

    if (Math.abs(parsed.amount - checkout.amount) > 0.01) {
      console.error(`${logPrefix} kiosk checkout amount mismatch`, {
        expected: checkout.amount,
        received: parsed.amount,
      });
      return {
        matched: true,
        kind: "kiosk",
        orderId: checkout.orderId,
        status: parsed.status,
        error: "amount_mismatch",
      };
    }

    let orderId: string | null = checkout.orderId;

    if (parsed.success) {
      // A provider retry re-enters here with the checkout already completed -
      // remember that so the kitchen ticket only prints on first processing.
      const firstProcessing = checkout.status !== "completed";
      const result = await materializeKioskCheckout(checkoutId);
      if (!result.ok) {
        console.error(`${logPrefix} materialize failed`, result.code);
        return {
          matched: true,
          kind: "kiosk",
          orderId,
          status: parsed.status,
          error: "materialize_failed",
        };
      }
      orderId = result.orderId;

      await prisma.order.update({
        where: { id: result.orderId },
        data: {
          paymentStatus: PaymentStatus.paid,
          paymentIntentId: parsed.providerTransactionId,
          // CardCom issues the tax document inline and returns it on the same
          // result; Grow ships it later via the invoice-callback, and Hyp mails
          // its own (both leave these unset).
          ...(parsed.invoiceNumber ? { invoiceNumber: parsed.invoiceNumber } : {}),
          ...(parsed.invoiceUrl ? { invoiceUrl: parsed.invoiceUrl } : {}),
        },
      });

      await confirmAndBill(result.orderId, `${logPrefix} kiosk`);

      if (firstProcessing) {
        after(() => printOrderTicket(result.orderId, "card_paid"));
      }
    } else {
      await prisma.kioskPendingCheckout.update({
        where: { id: checkoutId },
        data: { status: "abandoned", providerResponse: parsed.rawData as object },
      });
    }

    void provider
      .acknowledgeCallback(parsed)
      .catch((err) => console.error(`${logPrefix} kiosk ack threw`, err));

    return { matched: true, kind: "kiosk", orderId, status: parsed.status };
  }

  // ── Standard order branch ─────────────────────────────────────────────
  // Match by providerRequestId (Grow processId / CardCom LowProfileId / Hyp
  // Order) first; fall back to orderReference (our Order.number).
  let pending = parsed.providerRequestId
    ? await prisma.pendingPayment.findFirst({
        where: { tenantId: tenant.id, providerRequestId: parsed.providerRequestId },
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (!pending && parsed.orderReference) {
    pending = await prisma.pendingPayment.findFirst({
      where: { tenantId: tenant.id, orderReference: parsed.orderReference },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!pending) {
    console.warn(`${logPrefix} no pending payment matched`, {
      providerRequestId: parsed.providerRequestId,
      orderReference: parsed.orderReference,
    });
    return { matched: false, kind: "none", orderId: null, status: parsed.status };
  }

  // Amount sanity check. Both sides are in **whole shekels** (Order.total,
  // PendingPayment.amount, Grow's `sum`, CardCom's `Amount` and Hyp's `Amount`
  // are all shekels in QuickFood). Allow ₪0.01 of float-rounding slack.
  if (Math.abs(parsed.amount - pending.amount) > 0.01) {
    console.error(`${logPrefix} amount mismatch`, {
      pending: pending.amount,
      received: parsed.amount,
    });
    await prisma.pendingPayment.update({
      where: { id: pending.id },
      data: {
        status: PendingPaymentStatus.failed,
        providerResponse: parsed.rawData as object,
      },
    });
    return {
      matched: true,
      kind: "order",
      orderId: pending.orderId,
      status: parsed.status,
      error: "amount_mismatch",
    };
  }

  // ── J5 hold branch ─────────────────────────────────────────────────────
  // The card was authorized and the amount reserved, but NOT captured. Record
  // the authorization so the merchant can capture it later, but leave the
  // order UNPAID and bill no commission until the capture succeeds.
  //
  // Two sub-modes (settings.captureOnApproval):
  //   - OFF (default): auto-confirm the order so the kitchen works and print
  //     the ticket; the merchant captures manually with "חייב עכשיו".
  //   - ON: hold the order in `pending` (awaiting approval, NOT in the kitchen)
  //     and alert the merchant to accept it - accepting runs the capture, and
  //     the ticket prints then. See the status route.
  if (parsed.status === "authorized") {
    const existingAuth = await prisma.paymentTransaction.findUnique({
      where: {
        provider_providerTransactionId: {
          provider: providerType,
          providerTransactionId: parsed.providerTransactionId,
        },
      },
    });

    if (!existingAuth) {
      await prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.create({
          data: {
            tenantId: tenant.id,
            orderId: pending!.orderId,
            pendingPaymentId: pending!.id,
            provider: providerType,
            status: PaymentTransactionStatus.authorized,
            amount: parsed.amount,
            currency: parsed.currency || "ILS",
            providerTransactionId: parsed.providerTransactionId,
            providerRequestId: parsed.providerRequestId,
            providerToken: parsed.providerToken,
            approvalNumber: parsed.approvalNumber,
            cardBrand: parsed.cardBrand,
            cardLastFour: parsed.cardLastFour,
            providerResponse: parsed.rawData as object,
          },
        });

        await tx.pendingPayment.update({
          where: { id: pending!.id },
          data: {
            status: PendingPaymentStatus.confirmed,
            confirmedAt: new Date(),
            providerResponse: parsed.rawData as object,
          },
        });

        await tx.order.update({
          where: { id: pending!.orderId },
          data: {
            paymentStatus: PaymentStatus.authorized,
            paymentIntentId: parsed.providerTransactionId,
          },
        });
      });

      const cfg = await prisma.paymentProviderConfig.findUnique({
        where: { tenantId_provider: { tenantId: tenant.id, provider: providerType } },
        select: { settings: true },
      });
      const captureOnApproval =
        (cfg?.settings as { captureOnApproval?: boolean } | null)?.captureOnApproval === true;

      if (captureOnApproval) {
        // Leave the order pending for the merchant to approve; the auto-confirm
        // push won't fire, so alert them here. Ticket prints at approval.
        // We also never advanceStatus, so no order.status_changed event fires -
        // nudge any open board to refetch so the hold shows up live as a
        // pending-approval card, not only on the next manual reload.
        const held = await prisma.order.findUnique({
          where: { id: pending.orderId },
          select: { number: true },
        });
        publishOrderCreated(tenant.id, {
          id: pending.orderId,
          number: held?.number ?? "",
          status: OrderStatus.pending,
        });
        after(() => alertMerchantNewOrder(pending!.orderId));
      } else {
        await confirmAndBill(pending.orderId, logPrefix, { bill: false });
        after(() => printOrderTicket(pending!.orderId, "card_paid"));
      }
    }

    void provider
      .acknowledgeCallback(parsed)
      .catch((err) => console.error(`${logPrefix} authorized ack threw`, err));

    return { matched: true, kind: "order", orderId: pending.orderId, status: parsed.status };
  }

  // Idempotency: if we've already created a transaction for this provider/txnId,
  // skip the order mutation but still try to re-ack (the provider may have
  // retried, or the customer may have refreshed the return URL).
  const existingTxn = await prisma.paymentTransaction.findUnique({
    where: {
      provider_providerTransactionId: {
        provider: providerType,
        providerTransactionId: parsed.providerTransactionId,
      },
    },
  });

  if (parsed.success) {
    if (!existingTxn) {
      await prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.create({
          data: {
            tenantId: tenant.id,
            orderId: pending!.orderId,
            pendingPaymentId: pending!.id,
            provider: providerType,
            status: PaymentTransactionStatus.success,
            amount: parsed.amount,
            currency: parsed.currency || "ILS",
            providerTransactionId: parsed.providerTransactionId,
            providerRequestId: parsed.providerRequestId,
            providerToken: parsed.providerToken,
            approvalNumber: parsed.approvalNumber,
            cardBrand: parsed.cardBrand,
            cardLastFour: parsed.cardLastFour,
            providerResponse: parsed.rawData as object,
          },
        });

        await tx.pendingPayment.update({
          where: { id: pending!.id },
          data: {
            status: PendingPaymentStatus.confirmed,
            confirmedAt: new Date(),
            providerResponse: parsed.rawData as object,
          },
        });

        await tx.order.update({
          where: { id: pending!.orderId },
          data: {
            paymentStatus: PaymentStatus.paid,
            paymentIntentId: parsed.providerTransactionId,
            ...(parsed.invoiceNumber ? { invoiceNumber: parsed.invoiceNumber } : {}),
            ...(parsed.invoiceUrl ? { invoiceUrl: parsed.invoiceUrl } : {}),
          },
        });
      });

      await confirmAndBill(pending.orderId, logPrefix);
      after(() => printOrderTicket(pending!.orderId, "card_paid"));
    }
  } else if (pending.status === PendingPaymentStatus.pending) {
    await prisma.pendingPayment.update({
      where: { id: pending.id },
      data: {
        status: PendingPaymentStatus.failed,
        providerResponse: parsed.rawData as object,
      },
    });
  }

  // Acknowledge to the provider (non-blocking) - keep this OUTSIDE the
  // transaction. Grow needs it or it retries up to 6 times; CardCom and Hyp
  // no-op.
  void provider
    .acknowledgeCallback(parsed)
    .then((ack) => {
      if (!ack.success) {
        console.warn(`${logPrefix} acknowledgeCallback failed`, ack.error);
      }
    })
    .catch((err) => console.error(`${logPrefix} acknowledgeCallback threw`, err));

  return { matched: true, kind: "order", orderId: pending.orderId, status: parsed.status };
}
