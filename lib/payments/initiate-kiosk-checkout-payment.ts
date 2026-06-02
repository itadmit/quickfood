import { prisma } from "@/lib/db/client";
import { getConfiguredProvider } from "@/lib/payments/factory";
import type { InitiatePaymentRequest } from "@/lib/payments/types";
import { idToCheckoutRef } from "@/lib/orders/kiosk-checkout";
import { PaymentProvider } from "@prisma/client";
import type { CreateOrderInput } from "@/lib/orders-create";

export interface InitiateKioskCheckoutData {
  provider: PaymentProvider;
  sdk_auth_code: string | null;
  payment_url: string | null;
  provider_request_id: string | null;
  test_mode: boolean;
}

export type InitiateKioskCheckoutResult =
  | { ok: true; data: InitiateKioskCheckoutData }
  | { ok: false; code: string; message: string; status: number };

export async function initiateKioskCheckoutPayment(
  checkoutId: string,
): Promise<InitiateKioskCheckoutResult> {
  const checkout = await prisma.kioskPendingCheckout.findUnique({
    where: { id: checkoutId },
    select: {
      id: true,
      tenantId: true,
      amount: true,
      status: true,
      orderId: true,
      cartData: true,
      expiresAt: true,
      tenant: { select: { slug: true } },
    },
  });
  if (!checkout) return { ok: false, code: "not_found", message: "checkout לא נמצא", status: 404 };
  if (checkout.status === "completed") {
    return { ok: false, code: "already_paid", message: "התשלום כבר בוצע", status: 409 };
  }
  if (checkout.status === "abandoned") {
    return { ok: false, code: "abandoned", message: "ה-checkout בוטל", status: 409 };
  }
  if (checkout.expiresAt < new Date()) {
    return { ok: false, code: "expired", message: "ה-checkout פג תוקף", status: 410 };
  }

  const providerType = PaymentProvider.grow;
  const [provider, providerConfig] = await Promise.all([
    getConfiguredProvider(checkout.tenantId, providerType),
    prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: { tenantId: checkout.tenantId, provider: providerType },
      },
      select: { testMode: true },
    }),
  ]);
  if (!provider) {
    return { ok: false, code: "provider_unavailable", message: "ספק התשלום לא מוגדר", status: 503 };
  }

  const input = checkout.cartData as unknown as CreateOrderInput;
  const composedName =
    [input.guestFirstName, input.guestLastName].filter(Boolean).join(" ") || "Customer";
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const ref = idToCheckoutRef(checkout.id);

  const initiateReq: InitiatePaymentRequest = {
    tenantId: checkout.tenantId,
    tenantSlug: checkout.tenant.slug,
    orderId: checkout.id,
    orderReference: ref,
    amount: checkout.amount,
    currency: "ILS",
    customer: {
      name: composedName,
      email: input.customerEmail ?? undefined,
      phone: input.guestPhone ?? undefined,
    },
    items: [
      { name: "הזמנת קיוסק", quantity: 1, price: checkout.amount },
    ],
    successUrl: `${baseUrl}/checkout/thank-you?ref=${encodeURIComponent(ref)}`,
    cancelUrl: `${baseUrl}/checkout/cancel?ref=${encodeURIComponent(ref)}`,
    failureUrl: `${baseUrl}/checkout/failed?ref=${encodeURIComponent(ref)}`,
  };

  const result = await provider.initiatePayment(initiateReq);
  if (!result.success) {
    return {
      ok: false,
      code: result.errorCode || "payment_initiate_failed",
      message: result.errorMessage || "Failed to initiate payment",
      status: 502,
    };
  }

  await prisma.kioskPendingCheckout.update({
    where: { id: checkout.id },
    data: {
      growProcessId: result.providerRequestId,
      authCode: result.sdkAuthCode,
      providerResponse: (result.providerResponse ?? {}) as object,
    },
  });

  return {
    ok: true,
    data: {
      provider: providerType,
      sdk_auth_code: result.sdkAuthCode ?? null,
      payment_url: result.paymentUrl ?? null,
      provider_request_id: result.providerRequestId ?? null,
      test_mode: providerConfig?.testMode ?? true,
    },
  };
}
