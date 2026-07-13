/**
 * Shared payment-initiation core, used by two callers:
 *   1. POST /api/v1/customer/orders/[id]/pay/initiate  (standalone - PayPage)
 *   2. POST /api/v1/customer/orders                     (inline, on create -
 *      lets the checkout flow skip a second round-trip)
 *
 * Returns a discriminated result instead of a Response so each caller maps
 * it to its own contract: the standalone route turns failures into apiError,
 * the inline caller simply omits the `payment` block and lets the client
 * fall back to the standalone route.
 *
 * Access control (customer-owns-order) is NOT done here - the standalone
 * route enforces it; the inline caller just created the order so ownership
 * is implicit.
 */

import { prisma } from "@/lib/db/client";
import { getConfiguredProvider } from "@/lib/payments/factory";
import type { InitiatePaymentRequest } from "@/lib/payments/types";
import { fullName } from "@/lib/format";
import {
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PendingPaymentStatus,
} from "@prisma/client";

export interface InitiatePaymentData {
  pending_payment_id: string;
  provider: PaymentProvider;
  sdk_auth_code: string | null;
  payment_url: string | null;
  provider_request_id: string | null;
  test_mode: boolean;
  success_url: string;
  cancel_url: string;
}

export type InitiateOrderPaymentResult =
  | { ok: true; data: InitiatePaymentData }
  | { ok: false; code: string; message: string; status: number };

/**
 * Build the Grow payment process for an order and persist a pending-payment
 * row. Idempotency is the caller's concern: invoking twice creates two
 * pending rows (harmless - the callback reconciles by orderReference).
 */
export async function initiateOrderPayment(
  orderId: string,
): Promise<InitiateOrderPaymentResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      tenant: { select: { id: true, slug: true } },
      items: true,
    },
  });
  if (!order) return { ok: false, code: "not_found", message: "הזמנה לא נמצאה", status: 404 };

  if (order.paymentStatus === PaymentStatus.paid) {
    return { ok: false, code: "already_paid", message: "ההזמנה כבר שולמה", status: 409 };
  }
  if (order.paymentStatus === PaymentStatus.refunded) {
    return { ok: false, code: "refunded", message: "לא ניתן לשלם על הזמנה שזוכתה", status: 409 };
  }
  if (order.paymentMethod === PaymentMethod.cash) {
    return { ok: false, code: "cash_payment", message: "הזמנת מזומן לא דורשת אתחול תשלום", status: 400 };
  }

  const providerType = PaymentProvider.grow;

  // Independent reads run in parallel - provider config, provider instance,
  // and the customer row don't depend on each other (cuts ~2 sequential
  // Neon round-trips off the critical path; same query count, so no extra
  // DB cost).
  const [provider, providerConfig, customer] = await Promise.all([
    getConfiguredProvider(order.tenantId, providerType),
    prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: { tenantId: order.tenantId, provider: providerType },
      },
      select: { testMode: true },
    }),
    order.customerId
      ? prisma.customer.findUnique({
          where: { id: order.customerId },
          select: { firstName: true, lastName: true, email: true, phone: true },
        })
      : Promise.resolve(null),
  ]);

  if (!provider) {
    return { ok: false, code: "provider_unavailable", message: "ספק התשלום לא מוגדר במסעדה", status: 503 };
  }

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const orderRef = order.number;

  // Split-payment support: if cash has already been collected toward this
  // order (POS partial-cash flow), Grow only charges the remainder. The
  // PendingPayment row stores the same remainder so the callback's
  // amount-sanity-check matches what Grow returns. Order.total stays
  // untouched - it's the source of truth for "is this order paid yet?"
  const cashCollected = order.cashCollected ?? 0;
  const amountToCharge =
    cashCollected > 0 && cashCollected < order.total
      ? order.total - cashCollected
      : order.total;

  const composedName =
    fullName(order.customerFirstNameSnap, order.customerLastNameSnap) ||
    fullName(customer?.firstName, customer?.lastName) ||
    "Customer";

  // Grow validates `sum == Σ(productData.price × quantity)` server-side, so
  // we append synthetic rows for the non-item charges to keep it honest.
  const items: InitiatePaymentRequest["items"] = order.items.map((it) => ({
    name: it.nameSnapshot,
    sku: undefined,
    quantity: it.quantity,
    price: it.unitPrice,
  }));
  if (order.deliveryFee > 0) {
    items.push({ name: "דמי משלוח", quantity: 1, price: order.deliveryFee });
  }
  if (order.serviceFee > 0) {
    items.push({ name: "דמי שירות", quantity: 1, price: order.serviceFee });
  }
  if (order.tip > 0) {
    items.push({ name: "טיפ", quantity: 1, price: order.tip });
  }
  if (order.discount > 0) {
    items.push({ name: "הנחה", quantity: 1, price: -order.discount });
  }

  const initiateReq: InitiatePaymentRequest = {
    tenantId: order.tenantId,
    tenantSlug: order.tenant.slug,
    orderId: order.id,
    orderReference: orderRef,
    amount: amountToCharge,
    currency: "ILS",
    customer: {
      name: composedName,
      email: customer?.email ?? undefined,
      phone: customer?.phone ?? order.customerPhoneSnap ?? undefined,
    },
    items,
    successUrl: `${baseUrl}/checkout/thank-you?ref=${encodeURIComponent(orderRef)}`,
    cancelUrl: `${baseUrl}/checkout/cancel?ref=${encodeURIComponent(orderRef)}`,
    failureUrl: `${baseUrl}/checkout/failed?ref=${encodeURIComponent(orderRef)}`,
  };

  // Pending row up-front so the callback can match by providerRequestId AND
  // orderReference.
  const pending = await prisma.pendingPayment.create({
    data: {
      tenantId: order.tenantId,
      orderId: order.id,
      orderReference: orderRef,
      provider: providerType,
      amount: amountToCharge,
      currency: "ILS",
      status: PendingPaymentStatus.pending,
      expiresAt: new Date(Date.now() + 12 * 60_000),
    },
  });

  const result = await provider.initiatePayment(initiateReq);

  if (!result.success) {
    await prisma.pendingPayment.update({
      where: { id: pending.id },
      data: {
        status: PendingPaymentStatus.failed,
        providerResponse: (result.providerResponse ?? {}) as object,
      },
    });
    return {
      ok: false,
      code: result.errorCode || "payment_initiate_failed",
      message: result.errorMessage || "Failed to initiate payment",
      status: 502,
    };
  }

  await prisma.pendingPayment.update({
    where: { id: pending.id },
    data: {
      providerRequestId: result.providerRequestId,
      authCode: result.sdkAuthCode,
      providerResponse: (result.providerResponse ?? {}) as object,
    },
  });

  return {
    ok: true,
    data: {
      pending_payment_id: pending.id,
      provider: providerType,
      sdk_auth_code: result.sdkAuthCode ?? null,
      payment_url: result.paymentUrl ?? null,
      provider_request_id: result.providerRequestId ?? null,
      test_mode: providerConfig?.testMode ?? true,
      success_url: initiateReq.successUrl,
      cancel_url: initiateReq.cancelUrl,
    },
  };
}
