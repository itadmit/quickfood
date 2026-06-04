/**
 * GET  /api/v1/merchant/payments — current payment-accept config for this tenant
 * PATCH /api/v1/merchant/payments — owner/manager only; upserts the config
 *
 * The multi-provider model: tenant.acceptsCash + (optional) Grow
 * PaymentProviderConfig. At least one must be active before saving.
 *
 * Sensitive fields: `user_id` and `apple_pay_domain_association` are returned
 * to the merchant (they own them). Platform-level env (GROW_API_KEY,
 * GROW_PAGE_CODE) is NEVER exposed.
 */

import { apiError, apiJson, handler } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { MerchantPaymentsPatchSchema } from "@/lib/validate";
import { PaymentMethod, PaymentProvider, Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GrowCredentials {
  userId?: string;
  pageCode?: string;
  apiKey?: string;
  [k: string]: unknown;
}

interface GrowSettings {
  maxInstallments?: number;
  [k: string]: unknown;
}

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      acceptsCash: true,
      customDomain: true,
      defaultPaymentMethod: true,
    },
  });
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  const config = await prisma.paymentProviderConfig.findUnique({
    where: {
      tenantId_provider: {
        tenantId: session.tenantId,
        provider: PaymentProvider.grow,
      },
    },
  });

  const credentials = (config?.credentials ?? {}) as GrowCredentials;
  const settings = (config?.settings ?? {}) as GrowSettings;

  return apiJson({
    accepts_cash: tenant.acceptsCash,
    custom_domain: tenant.customDomain,
    default_payment_method: tenant.defaultPaymentMethod,
    grow: {
      is_active: config?.isActive ?? false,
      test_mode: config?.testMode ?? true,
      user_id: credentials.userId ?? "",
      page_code: credentials.pageCode ?? "",
      api_key: credentials.apiKey ?? "",
      max_installments: settings.maxInstallments ?? 1,
      apple_pay_domain_association: config?.applePayDomainAssociation ?? "",
    },
  });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = MerchantPaymentsPatchSchema.parse(await req.json());

  // Validate the default-method choice up-front so we never persist a
  // value that won't appear at checkout: it must be a method this
  // tenant is currently accepting.
  if (body.default_payment_method !== undefined && body.default_payment_method !== null) {
    const chosen = body.default_payment_method;
    const growActive = body.grow?.is_active ?? false;
    const allowed = new Set<PaymentMethod>();
    if (body.accepts_cash) allowed.add(PaymentMethod.cash);
    if (growActive) {
      allowed.add(PaymentMethod.card);
      allowed.add(PaymentMethod.bit);
      allowed.add(PaymentMethod.apple_pay);
      allowed.add(PaymentMethod.google_pay);
    }
    if (!allowed.has(chosen as PaymentMethod)) {
      return apiError(
        "validation_error",
        "ברירת המחדל חייבת להיות אחד מאמצעי התשלום שמופעלים",
        422,
        "default_payment_method",
      );
    }
  }

  // 1) Tenant-level toggle for cash + default-method
  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      acceptsCash: body.accepts_cash,
      ...(body.default_payment_method !== undefined && {
        defaultPaymentMethod: body.default_payment_method as PaymentMethod | null,
      }),
    },
  });

  // 2) Grow provider config (optional in the payload)
  if (body.grow) {
    const existing = await prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: {
          tenantId: session.tenantId,
          provider: PaymentProvider.grow,
        },
      },
    });

    const prevCreds = (existing?.credentials ?? {}) as GrowCredentials;
    const prevSettings = (existing?.settings ?? {}) as GrowSettings;

    const nextCreds: GrowCredentials = { ...prevCreds };
    if (body.grow.user_id !== undefined) nextCreds.userId = body.grow.user_id;
    if (body.grow.page_code !== undefined) {
      if (body.grow.page_code === "") delete nextCreds.pageCode;
      else nextCreds.pageCode = body.grow.page_code;
    }
    if (body.grow.api_key !== undefined) {
      if (body.grow.api_key === "") delete nextCreds.apiKey;
      else nextCreds.apiKey = body.grow.api_key;
    }

    const nextSettings: GrowSettings = { ...prevSettings };
    if (body.grow.max_installments !== undefined) {
      nextSettings.maxInstallments = body.grow.max_installments;
    }

    // Production needs all 3 credentials filled before the wallet can
    // open; sandbox uses shared QuickFood test creds, so flipping the
    // toggle on is enough.
    const willBeActive = body.grow.is_active;
    const willBeProduction = body.grow.test_mode === false;
    if (willBeActive && willBeProduction) {
      if (!nextCreds.userId) {
        return apiError("validation_error", "Production: יש למלא User ID", 422, "user_id");
      }
      if (!nextCreds.apiKey) {
        return apiError("validation_error", "Production: יש למלא API Key", 422, "api_key");
      }
      if (!nextCreds.pageCode) {
        return apiError("validation_error", "Production: יש למלא Page Code", 422, "page_code");
      }
    }

    const applePayUpdate =
      body.grow.apple_pay_domain_association === undefined
        ? undefined
        : body.grow.apple_pay_domain_association === null ||
            body.grow.apple_pay_domain_association === ""
          ? null
          : body.grow.apple_pay_domain_association;

    await prisma.paymentProviderConfig.upsert({
      where: {
        tenantId_provider: {
          tenantId: session.tenantId,
          provider: PaymentProvider.grow,
        },
      },
      create: {
        tenantId: session.tenantId,
        provider: PaymentProvider.grow,
        credentials: nextCreds as Prisma.InputJsonValue,
        settings: nextSettings as Prisma.InputJsonValue,
        testMode: body.grow.test_mode ?? true,
        isActive: body.grow.is_active,
        applePayDomainAssociation: applePayUpdate ?? null,
      },
      update: {
        credentials: nextCreds as Prisma.InputJsonValue,
        settings: nextSettings as Prisma.InputJsonValue,
        testMode: body.grow.test_mode ?? existing?.testMode ?? true,
        isActive: body.grow.is_active,
        ...(applePayUpdate !== undefined
          ? { applePayDomainAssociation: applePayUpdate }
          : {}),
      },
    });
  }

  return apiJson({ ok: true });
});
