/**
 * GET  /api/v1/merchant/payments — current provider + config for this tenant
 * PATCH /api/v1/merchant/payments — owner/manager only; upserts the config
 *
 * Sensitive fields: `user_id` and `apple_pay_domain_association` are returned
 * to the merchant (they own them). Platform-level env (GROW_API_KEY,
 * GROW_PAGE_CODE) is NEVER exposed.
 */

import { apiError, apiJson, handler } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { MerchantPaymentsPatchSchema } from "@/lib/validate";
import { PaymentProvider, Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GrowCredentials {
  userId?: string;
  pageCode?: string;
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
      paymentProvider: true,
      customDomain: true,
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
    provider: tenant.paymentProvider,
    custom_domain: tenant.customDomain,
    grow: config
      ? {
          is_active: config.isActive,
          test_mode: config.testMode,
          user_id: credentials.userId ?? "",
          page_code: credentials.pageCode ?? "",
          max_installments: settings.maxInstallments ?? 1,
          apple_pay_domain_association:
            config.applePayDomainAssociation ?? "",
        }
      : {
          is_active: false,
          test_mode: true,
          user_id: "",
          page_code: "",
          max_installments: 1,
          apple_pay_domain_association: "",
        },
  });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = MerchantPaymentsPatchSchema.parse(await req.json());

  // Update Tenant.paymentProvider (the default the customer flow uses).
  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { paymentProvider: body.provider },
  });

  // If switching to cash, nothing more to do — Grow config row can remain
  // (just inactive). The flow at /pay/initiate gates on Tenant.paymentProvider.
  if (body.provider === "cash") {
    return apiJson({ ok: true, provider: "cash" });
  }

  // Grow — upsert the PaymentProviderConfig row.
  const existing = await prisma.paymentProviderConfig.findUnique({
    where: {
      tenantId_provider: {
        tenantId: session.tenantId,
        provider: PaymentProvider.grow,
      },
    },
  });

  // Merge credentials so we don't blow away fields we didn't touch
  const prevCreds = (existing?.credentials ?? {}) as GrowCredentials;
  const prevSettings = (existing?.settings ?? {}) as GrowSettings;

  const nextCreds: GrowCredentials = { ...prevCreds };
  if (body.user_id !== undefined) nextCreds.userId = body.user_id;
  if (body.page_code !== undefined) {
    if (body.page_code === "") delete nextCreds.pageCode;
    else nextCreds.pageCode = body.page_code;
  }

  const nextSettings: GrowSettings = { ...prevSettings };
  if (body.max_installments !== undefined) {
    nextSettings.maxInstallments = body.max_installments;
  }

  // userId is mandatory before enabling Grow
  const wantsActive = body.is_active ?? existing?.isActive ?? false;
  if (wantsActive && !nextCreds.userId) {
    return apiError(
      "validation_error",
      "יש למלא User ID לפני הפעלת Grow",
      422,
      "user_id",
    );
  }

  const applePayUpdate =
    body.apple_pay_domain_association === undefined
      ? undefined
      : body.apple_pay_domain_association === null ||
          body.apple_pay_domain_association === ""
        ? null
        : body.apple_pay_domain_association;

  const config = await prisma.paymentProviderConfig.upsert({
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
      testMode: body.test_mode ?? true,
      isActive: wantsActive,
      applePayDomainAssociation: applePayUpdate ?? null,
    },
    update: {
      credentials: nextCreds as Prisma.InputJsonValue,
      settings: nextSettings as Prisma.InputJsonValue,
      testMode: body.test_mode ?? existing?.testMode ?? true,
      isActive: wantsActive,
      ...(applePayUpdate !== undefined
        ? { applePayDomainAssociation: applePayUpdate }
        : {}),
    },
  });

  return apiJson({
    ok: true,
    provider: "grow",
    grow: {
      is_active: config.isActive,
      test_mode: config.testMode,
      user_id: (config.credentials as GrowCredentials).userId ?? "",
    },
  });
});
