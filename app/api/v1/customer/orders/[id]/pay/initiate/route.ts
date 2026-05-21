/**
 * POST /api/v1/customer/orders/[id]/pay/initiate
 *
 * Initiate a payment for an order. For Grow, returns an `sdk_auth_code` that
 * the client passes to `window.growPayment.renderPaymentOptions(code)` to
 * render the inline wallet. Final state is set by Grow's S2S callback to
 * /api/payments/callback?provider=grow&tenant=<slug>.
 */

import { apiError, apiJson, handler } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: orderId } = await params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tenant: { select: { id: true, slug: true } },
        items: true,
      },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

    // Visibility matches GET /customer/orders/[id]: if a logged-in customer
    // is calling, the order must be theirs. Guest orders (no customerId)
    // are reachable by anyone holding the UUID — same as the tracking page.
    const session = await getSession();
    if (
      session?.type === "customer" &&
      order.customerId &&
      order.customerId !== session.userId
    ) {
      return apiError("forbidden", "אין הרשאה להזמנה זו", 403);
    }
    if (order.paymentStatus === PaymentStatus.paid) {
      return apiError("already_paid", "ההזמנה כבר שולמה", 409);
    }
    if (order.paymentStatus === PaymentStatus.refunded) {
      return apiError("refunded", "לא ניתן לשלם על הזמנה שזוכתה", 409);
    }

    // Cash orders don't go through a provider — they're settled on delivery.
    if (order.paymentMethod === PaymentMethod.cash) {
      return apiError(
        "cash_payment",
        "הזמנת מזומן לא דורשת אתחול תשלום",
        400,
      );
    }

    // All non-cash methods (card/bit/apple_pay/google_pay) currently route
    // through Grow's wallet — the SDK shows the right button per method.
    const providerType = PaymentProvider.grow;
    const provider = await getConfiguredProvider(order.tenantId, providerType);
    if (!provider) {
      return apiError("provider_unavailable", "ספק התשלום לא מוגדר במסעדה", 503);
    }
    // Load the raw config row so we can echo `testMode` back to the client.
    // The SDK environment MUST match the API mode that created the authCode
    // (sandbox auth codes don't resolve under PRODUCTION and vice versa).
    const providerConfig = await prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: { tenantId: order.tenantId, provider: providerType },
      },
      select: { testMode: true },
    });

    const customer = order.customerId
      ? await prisma.customer.findUnique({
          where: { id: order.customerId },
          select: { firstName: true, lastName: true, email: true, phone: true },
        })
      : null;

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const orderRef = order.number; // already unique, human readable

    const composedName =
      fullName(customer?.firstName, customer?.lastName) ||
      fullName(order.customerFirstNameSnap, order.customerLastNameSnap) ||
      "Customer";

    const initiateReq: InitiatePaymentRequest = {
      tenantId: order.tenantId,
      tenantSlug: order.tenant.slug,
      orderId: order.id,
      orderReference: orderRef,
      // QuickFood stores Order.total + OrderItem.unitPrice as **whole shekels**
      // (verified against the DB: a ₪141 order is `total: 141`, not 14100).
      // Earlier the code divided by 100 here, treating the values as agorot —
      // which sent ₪1.41 to Grow instead of ₪141.
      amount: order.total,
      currency: "ILS",
      customer: {
        name: composedName,
        email: customer?.email ?? undefined,
        phone: customer?.phone ?? order.customerPhoneSnap ?? undefined,
      },
      items: order.items.map((it) => ({
        name: it.nameSnapshot,
        sku: undefined,
        quantity: it.quantity,
        price: it.unitPrice,
      })),
      successUrl: `${baseUrl}/checkout/thank-you?ref=${encodeURIComponent(orderRef)}`,
      cancelUrl: `${baseUrl}/checkout/cancel?ref=${encodeURIComponent(orderRef)}`,
      failureUrl: `${baseUrl}/checkout/failed?ref=${encodeURIComponent(orderRef)}`,
    };

    // Create a pending-payment row up-front so the callback can match by
    // providerRequestId AND orderReference (defense in depth).
    const pending = await prisma.pendingPayment.create({
      data: {
        tenantId: order.tenantId,
        orderId: order.id,
        orderReference: orderRef,
        provider: providerType,
        amount: order.total,
        currency: "ILS",
        status: PendingPaymentStatus.pending,
        expiresAt: new Date(Date.now() + 12 * 60_000), // Grow link is valid ~10 min; pad a bit
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
      return apiError(
        result.errorCode || "payment_initiate_failed",
        result.errorMessage || "Failed to initiate payment",
        502,
      );
    }

    await prisma.pendingPayment.update({
      where: { id: pending.id },
      data: {
        providerRequestId: result.providerRequestId,
        authCode: result.sdkAuthCode,
        providerResponse: (result.providerResponse ?? {}) as object,
      },
    });

    return apiJson({
      pending_payment_id: pending.id,
      provider: providerType,
      sdk_auth_code: result.sdkAuthCode ?? null,
      payment_url: result.paymentUrl ?? null,
      provider_request_id: result.providerRequestId ?? null,
      // The SDK's environment must match the API mode that issued the authCode.
      // Default true (sandbox) if the column is missing for any reason.
      test_mode: providerConfig?.testMode ?? true,
      success_url: initiateReq.successUrl,
      cancel_url: initiateReq.cancelUrl,
    });
  },
);
