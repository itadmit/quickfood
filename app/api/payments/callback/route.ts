/**
 * POST /api/payments/callback
 *
 * Server-to-server callback from payment providers. Routed by ?provider=<type>
 * query param. Currently only Grow is implemented.
 *
 * For Grow:
 *   - Body is application/x-www-form-urlencoded (not JSON)
 *   - No HMAC signature; security relies on IP whitelist + unguessable URL
 *   - We MUST POST /approveTransaction back to Grow, or Grow will retry up to
 *     6 times. This is fired non-blocking after we finalize.
 *
 * Idempotent: re-processing the same callback after the Order is already paid
 * is a no-op (so Grow's retries are safe).
 */

import { after } from "next/server";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { advanceStatus, canTransition } from "@/lib/orders";
import { printOrderTicket } from "@/lib/printing/print-order";
import {
  checkoutRefToId,
  materializeKioskCheckout,
} from "@/lib/orders/kiosk-checkout";
import { recordOrderCommission } from "@/lib/billing-hub/commission";
import { getConfiguredProvider } from "@/lib/payments/factory";
import {
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PaymentTransactionStatus,
  PendingPaymentStatus,
} from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => (out[k.toLowerCase()] = v));
  return out;
}

async function parseRequestBody(req: Request): Promise<unknown> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return req.json();
  }
  const text = await req.text();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const parsed = new URLSearchParams(text);
    const obj: Record<string, string> = {};
    parsed.forEach((v, k) => (obj[k] = v));
    return obj;
  }
  // Best-effort: try JSON then fall back to urlencoded
  try {
    return JSON.parse(text);
  } catch {
    const parsed = new URLSearchParams(text);
    const obj: Record<string, string> = {};
    parsed.forEach((v, k) => (obj[k] = v));
    return obj;
  }
}

export const POST = handler(async (req: Request) => {
  const url = new URL(req.url);
  const providerParam = url.searchParams.get("provider");
  const tenantSlug = url.searchParams.get("tenant");

  // Entry log: confirms whether Grow actually reaches our domain at all
  // (diagnosing the "0/26 callbacks ever landed" issue). Every hit lands
  // here regardless of validation outcome.
  console.log("[payments/callback] HIT", {
    provider: providerParam,
    tenant: tenantSlug,
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null,
    ua: req.headers.get("user-agent") ?? null,
  });

  if (!providerParam) return apiError("missing_provider", "missing ?provider", 400);
  if (!tenantSlug) return apiError("missing_tenant", "missing ?tenant", 400);

  const providerType = providerParam as PaymentProvider;
  const SUPPORTED_PROVIDERS: PaymentProvider[] = [
    PaymentProvider.grow,
    PaymentProvider.cardcom,
  ];
  if (!SUPPORTED_PROVIDERS.includes(providerType)) {
    return apiError("unknown_provider", `provider not supported: ${providerParam}`, 400);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true },
  });
  if (!tenant) return apiError("tenant_not_found", "unknown tenant", 404);

  const provider = await getConfiguredProvider(tenant.id, providerType);
  if (!provider) return apiError("provider_unavailable", "provider not configured", 503);

  const headers = extractHeaders(req);
  const body = await parseRequestBody(req);

  const validation = provider.validateWebhook(body, headers);
  if (!validation.isValid) {
    console.warn("[payments/callback] validation failed", validation.error);
    return apiError("invalid_webhook", validation.error || "invalid webhook", 401);
  }

  // Awaited: CardCom's parseCallback is async (re-fetches the authoritative
  // result via GetLpResult). Grow's is sync - await passes its value through.
  const parsed = await provider.parseCallback(body);

  // Kiosk-card pre-checkout branch. If the reference Grow echoed back is
  // a checkout ref (KCO- prefix) the Order doesn't exist yet - we
  // materialize it from the cart snapshot here, then run the normal
  // pending-payment finalization path against the freshly-created order.
  const checkoutId = checkoutRefToId(parsed.orderReference);
  if (checkoutId) {
    const checkout = await prisma.kioskPendingCheckout.findUnique({
      where: { id: checkoutId },
      select: { id: true, tenantId: true, amount: true, status: true, orderId: true },
    });
    if (!checkout || checkout.tenantId !== tenant.id) {
      console.warn("[payments/callback] kiosk checkout not found", { checkoutId });
      return apiJson({ received: true, matched: false });
    }

    if (Math.abs(parsed.amount - checkout.amount) > 0.01) {
      console.error("[payments/callback] kiosk checkout amount mismatch", {
        expected: checkout.amount,
        received: parsed.amount,
      });
      return apiJson({ received: true, error: "amount_mismatch" }, 200);
    }

    if (parsed.success) {
      // A Grow retry re-enters here with the checkout already completed -
      // remember that so the kitchen ticket only prints on first processing.
      const firstProcessing = checkout.status !== "completed";
      const result = await materializeKioskCheckout(checkoutId);
      if (!result.ok) {
        console.error("[payments/callback] materialize failed", result.code);
        return apiJson({ received: true, materialized: false }, 200);
      }
      await prisma.order.update({
        where: { id: result.orderId },
        data: {
          paymentStatus: PaymentStatus.paid,
          paymentIntentId: parsed.providerTransactionId,
          // CardCom issues the tax document inline and returns it on the same
          // result; Grow ships it later via the invoice-callback (leaves unset).
          ...(parsed.invoiceNumber ? { invoiceNumber: parsed.invoiceNumber } : {}),
          ...(parsed.invoiceUrl ? { invoiceUrl: parsed.invoiceUrl } : {}),
        },
      });
      const order = await prisma.order.findUnique({
        where: { id: result.orderId },
        select: { status: true },
      });
      let confirmed = false;
      if (order && canTransition(order.status, OrderStatus.confirmed)) {
        try {
          await advanceStatus(result.orderId, OrderStatus.confirmed, {
            changedBy: "payment_callback",
            reason: "payment_received",
          });
          confirmed = true;
        } catch (err) {
          console.error("[payments/callback] kiosk advanceStatus failed", err);
        }
      }
      if (confirmed) {
        void recordOrderCommission(result.orderId).catch((err) => {
          console.error("[payments/callback] kiosk commission failed", err);
        });
      }
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
      .catch((err) => console.error("[payments/callback] kiosk ack threw", err));

    return apiJson({ received: true, matched: true, kiosk: true, status: parsed.status });
  }

  // Locate the pending payment. Match by providerRequestId (Grow processId)
  // first; fall back to orderReference (Grow cField1 ← our Order.number).
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
    console.warn("[payments/callback] no pending payment matched", {
      processId: parsed.providerRequestId,
      orderReference: parsed.orderReference,
    });
    // Still return 200 so Grow stops retrying. Logged for ops to investigate.
    return apiJson({ received: true, matched: false });
  }

  // Amount sanity check. Both sides are in **whole shekels** (Order.total,
  // PendingPayment.amount, and Grow's `sum` payload are all shekels in
  // QuickFood). Allow ₪0.01 of float-rounding slack.
  const expectedShekels = pending.amount;
  const receivedShekels = parsed.amount;
  if (Math.abs(receivedShekels - expectedShekels) > 0.01) {
    console.error("[payments/callback] amount mismatch", {
      pending: expectedShekels,
      received: receivedShekels,
    });
    await prisma.pendingPayment.update({
      where: { id: pending.id },
      data: {
        status: PendingPaymentStatus.failed,
        providerResponse: parsed.rawData as object,
      },
    });
    return apiJson({ received: true, error: "amount_mismatch" }, 200);
  }

  // Idempotency: if we've already created a transaction for this provider/txnId,
  // skip the order mutation but still try to re-ack (Grow may have retried).
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
            amount: receivedShekels,
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

      // Advance the order: pending ← confirmed (fires webhooks). Only
      // if legal. The 0.5% commission used to fire unconditionally here
      // - including for orders the merchant had already cancelled while
      // the callback was in flight, which billed the merchant for cash
      // they never got. Now it only runs after a successful transition.
      const order = await prisma.order.findUnique({
        where: { id: pending.orderId },
        select: { status: true },
      });
      let confirmed = false;
      if (order && canTransition(order.status, OrderStatus.confirmed)) {
        try {
          await advanceStatus(pending.orderId, OrderStatus.confirmed, {
            changedBy: "payment_callback",
            reason: "payment_received",
          });
          confirmed = true;
        } catch (err) {
          console.error("[payments/callback] advanceStatus failed", err);
        }
      }
      if (confirmed) {
        void recordOrderCommission(pending.orderId).catch((err) => {
          console.error("[payments/callback] commission record failed", err);
        });
      }
      after(() => printOrderTicket(pending!.orderId, "card_paid"));
    }
  } else {
    if (pending.status === PendingPaymentStatus.pending) {
      await prisma.pendingPayment.update({
        where: { id: pending.id },
        data: {
          status: PendingPaymentStatus.failed,
          providerResponse: parsed.rawData as object,
        },
      });
    }
  }

  // Acknowledge to Grow (non-blocking) - keep this OUTSIDE the transaction.
  void provider
    .acknowledgeCallback(parsed)
    .then((ack) => {
      if (!ack.success) {
        console.warn("[payments/callback] acknowledgeCallback failed", ack.error);
      }
    })
    .catch((err) => console.error("[payments/callback] acknowledgeCallback threw", err));

  return apiJson({ received: true, matched: true, status: parsed.status });
});
