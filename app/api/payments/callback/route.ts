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

import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { advanceStatus, canTransition } from "@/lib/orders";
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

  if (!providerParam) return apiError("missing_provider", "missing ?provider", 400);
  if (!tenantSlug) return apiError("missing_tenant", "missing ?tenant", 400);

  // We only support Grow right now
  const providerType = providerParam as PaymentProvider;
  if (providerType !== PaymentProvider.grow) {
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

  const parsed = provider.parseCallback(body);

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
          },
        });
      });

      // Advance the order: pending ← confirmed (fires webhooks). Only if legal.
      const order = await prisma.order.findUnique({
        where: { id: pending.orderId },
        select: { status: true },
      });
      if (order && canTransition(order.status, OrderStatus.confirmed)) {
        try {
          await advanceStatus(pending.orderId, OrderStatus.confirmed, {
            changedBy: "payment_callback",
            reason: "payment_received",
          });
        } catch (err) {
          console.error("[payments/callback] advanceStatus failed", err);
        }
      }

      // Record the 0.5% commission as soon as the card actually paid — we
      // can't wait for the merchant to manually mark `delivered`, since some
      // never do. The hub dedupes by `idempotency_key: "order:<orderId>"`,
      // so a cash order that also fires this on delivery won't double-charge.
      void recordOrderCommission(pending.orderId).catch((err) => {
        console.error("[payments/callback] commission record failed", err);
      });
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

  // Acknowledge to Grow (non-blocking) — keep this OUTSIDE the transaction.
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
