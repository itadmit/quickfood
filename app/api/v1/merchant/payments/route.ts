/**
 * GET  /api/v1/merchant/payments - current payment-accept config for this tenant
 * PATCH /api/v1/merchant/payments - owner/manager only; upserts the config
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
  bankTransferEnabled?: boolean;
  applePayEnabled?: boolean;
  [k: string]: unknown;
}

interface CardComCredentials {
  terminalNumber?: string;
  apiName?: string;
  apiPassword?: string;
  [k: string]: unknown;
}

interface CardComSettings {
  maxInstallments?: number;
  displayMode?: "iframe" | "redirect";
  createInvoice?: boolean;
  documentType?: string;
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

  const [config, cardcomConfig] = await Promise.all([
    prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: {
          tenantId: session.tenantId,
          provider: PaymentProvider.grow,
        },
      },
    }),
    prisma.paymentProviderConfig
      .findUnique({
        where: {
          tenantId_provider: {
            tenantId: session.tenantId,
            provider: PaymentProvider.cardcom,
          },
        },
      })
      // Degrade gracefully if the `cardcom` enum value isn't in the DB yet
      // (code deployed before the migration is applied) - show it as inactive.
      .catch(() => null),
  ]);

  const credentials = (config?.credentials ?? {}) as GrowCredentials;
  const settings = (config?.settings ?? {}) as GrowSettings;
  const ccCreds = (cardcomConfig?.credentials ?? {}) as CardComCredentials;
  const ccSettings = (cardcomConfig?.settings ?? {}) as CardComSettings;

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
      bank_transfer_enabled: settings.bankTransferEnabled ?? false,
      apple_pay_enabled: settings.applePayEnabled ?? false,
      apple_pay_domain_association: config?.applePayDomainAssociation ?? "",
    },
    cardcom: {
      is_active: cardcomConfig?.isActive ?? false,
      test_mode: cardcomConfig?.testMode ?? true,
      terminal_number: ccCreds.terminalNumber ?? "",
      api_name: ccCreds.apiName ?? "",
      api_password: ccCreds.apiPassword ?? "",
      max_installments: ccSettings.maxInstallments ?? 1,
      display_mode: ccSettings.displayMode ?? "redirect",
      create_invoice: ccSettings.createInvoice ?? false,
      document_type: ccSettings.documentType ?? "Order",
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
    const cardcomActive = body.cardcom?.is_active ?? false;
    const allowed = new Set<PaymentMethod>();
    if (body.accepts_cash) allowed.add(PaymentMethod.cash);
    if (growActive || cardcomActive) {
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
    if (body.grow.bank_transfer_enabled !== undefined) {
      nextSettings.bankTransferEnabled = body.grow.bank_transfer_enabled;
    }
    if (body.grow.apple_pay_enabled !== undefined) {
      nextSettings.applePayEnabled = body.grow.apple_pay_enabled;
    }

    // Production needs at minimum a userId (platform supplies apiKey +
    // pageCode via env vars). Per-tenant apiKey/pageCode overrides are
    // optional advanced settings - only for tenants on their own Grow
    // account rather than the platform. Sandbox is fully self-contained
    // via grow-test-creds.ts - no userId required.
    const effectiveTestMode = body.grow.test_mode ?? existing?.testMode ?? true;
    if (body.grow.is_active && !effectiveTestMode && !nextCreds.userId) {
      return apiError(
        "validation_error",
        "יש למלא User ID לפני הפעלת Grow ב-Production",
        422,
        "user_id",
      );
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

  // 3) CardCom provider config (optional in the payload)
  if (body.cardcom) {
    const existing = await prisma.paymentProviderConfig.findUnique({
      where: {
        tenantId_provider: {
          tenantId: session.tenantId,
          provider: PaymentProvider.cardcom,
        },
      },
    });

    const prevCreds = (existing?.credentials ?? {}) as CardComCredentials;
    const prevSettings = (existing?.settings ?? {}) as CardComSettings;

    const nextCreds: CardComCredentials = { ...prevCreds };
    if (body.cardcom.terminal_number !== undefined) {
      if (body.cardcom.terminal_number === "") delete nextCreds.terminalNumber;
      else nextCreds.terminalNumber = body.cardcom.terminal_number;
    }
    if (body.cardcom.api_name !== undefined) {
      if (body.cardcom.api_name === "") delete nextCreds.apiName;
      else nextCreds.apiName = body.cardcom.api_name;
    }
    if (body.cardcom.api_password !== undefined) {
      if (body.cardcom.api_password === "") delete nextCreds.apiPassword;
      else nextCreds.apiPassword = body.cardcom.api_password;
    }

    const nextSettings: CardComSettings = { ...prevSettings };
    if (body.cardcom.max_installments !== undefined) {
      nextSettings.maxInstallments = body.cardcom.max_installments;
    }
    if (body.cardcom.display_mode !== undefined) {
      nextSettings.displayMode = body.cardcom.display_mode;
    }
    if (body.cardcom.create_invoice !== undefined) {
      nextSettings.createInvoice = body.cardcom.create_invoice;
    }
    if (body.cardcom.document_type !== undefined) {
      nextSettings.documentType = body.cardcom.document_type;
    }

    // Live mode requires the full terminal credentials before activating.
    // Test mode falls back to the shared test terminal (see CardComProvider).
    const effectiveTestMode = body.cardcom.test_mode ?? existing?.testMode ?? true;
    if (
      body.cardcom.is_active &&
      !effectiveTestMode &&
      (!nextCreds.terminalNumber || !nextCreds.apiName || !nextCreds.apiPassword)
    ) {
      return apiError(
        "validation_error",
        "יש למלא מספר מסוף, שם API וסיסמת API לפני הפעלת CardCom במצב חי",
        422,
        "terminal_number",
      );
    }

    await prisma.paymentProviderConfig.upsert({
      where: {
        tenantId_provider: {
          tenantId: session.tenantId,
          provider: PaymentProvider.cardcom,
        },
      },
      create: {
        tenantId: session.tenantId,
        provider: PaymentProvider.cardcom,
        credentials: nextCreds as Prisma.InputJsonValue,
        settings: nextSettings as Prisma.InputJsonValue,
        testMode: body.cardcom.test_mode ?? true,
        isActive: body.cardcom.is_active,
      },
      update: {
        credentials: nextCreds as Prisma.InputJsonValue,
        settings: nextSettings as Prisma.InputJsonValue,
        testMode: body.cardcom.test_mode ?? existing?.testMode ?? true,
        isActive: body.cardcom.is_active,
      },
    });
  }

  return apiJson({ ok: true });
});
