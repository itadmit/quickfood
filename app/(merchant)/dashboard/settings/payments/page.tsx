import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { PaymentProvider } from "@prisma/client";
import { buildHypReturnUrl } from "@/lib/payments/providers/hyp";
import { SettingsHeader } from "../SettingsHeader";
import { PaymentsForm } from "./PaymentsForm";

export const dynamic = "force-dynamic";

interface GrowCredentials {
  userId?: string;
  pageCode?: string;
  apiKey?: string;
}

interface GrowSettings {
  maxInstallments?: number;
  bankTransferEnabled?: boolean;
  applePayEnabled?: boolean;
}

interface CardComCredentials {
  terminalNumber?: string;
  apiName?: string;
  apiPassword?: string;
}

interface CardComSettings {
  maxInstallments?: number;
  displayMode?: "iframe" | "redirect";
  createInvoice?: boolean;
  documentType?: string;
}

interface HypCredentials {
  masof?: string;
  passP?: string;
  apiKey?: string;
}

interface HypSettings {
  maxInstallments?: number;
  displayMode?: "iframe" | "redirect";
  hypSendInvoice?: boolean;
  deferredCapture?: boolean;
}

export default async function PaymentsSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      slug: true,
      acceptsCash: true,
      customDomain: true,
      defaultPaymentMethod: true,
    },
  });
  if (!tenant) redirect("/dashboard/login");

  const [config, cardcomConfig, hypConfig] = await Promise.all([
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
    prisma.paymentProviderConfig
      .findUnique({
        where: {
          tenantId_provider: {
            tenantId: session.tenantId,
            provider: PaymentProvider.hyp,
          },
        },
      })
      // Same grace period for the `hyp` enum value.
      .catch(() => null),
  ]);
  const creds = (config?.credentials ?? {}) as GrowCredentials;
  const settings = (config?.settings ?? {}) as GrowSettings;
  const ccCreds = (cardcomConfig?.credentials ?? {}) as CardComCredentials;
  const ccSettings = (cardcomConfig?.settings ?? {}) as CardComSettings;
  const hypCreds = (hypConfig?.credentials ?? {}) as HypCredentials;
  const hypSettings = (hypConfig?.settings ?? {}) as HypSettings;

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="איזה אמצעי תשלום המסעדה מקבלת - הלקוח יבחר בקופה" />
      <PaymentsForm
        canEditApplePay={Boolean(tenant.customDomain)}
        customDomain={tenant.customDomain}
        initial={{
          accepts_cash: tenant.acceptsCash,
          default_payment_method: tenant.defaultPaymentMethod ?? null,
          grow: {
            is_active: config?.isActive ?? false,
            test_mode: config?.testMode ?? true,
            user_id: creds.userId ?? "",
            page_code: creds.pageCode ?? "",
            api_key: creds.apiKey ?? "",
            max_installments: settings.maxInstallments ?? 1,
            bank_transfer_enabled: settings.bankTransferEnabled ?? false,
            apple_pay_enabled: settings.applePayEnabled ?? false,
            apple_pay_domain_association:
              config?.applePayDomainAssociation ?? "",
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
          hyp: {
            is_active: hypConfig?.isActive ?? false,
            test_mode: hypConfig?.testMode ?? true,
            masof: hypCreds.masof ?? "",
            pass_p: hypCreds.passP ?? "",
            api_key: hypCreds.apiKey ?? "",
            max_installments: hypSettings.maxInstallments ?? 1,
            display_mode: hypSettings.displayMode ?? "redirect",
            send_invoice: hypSettings.hypSendInvoice ?? false,
            late_charge: hypSettings.deferredCapture ?? false,
          },
        }}
        hypReturnUrl={buildHypReturnUrl(tenant.slug)}
      />
    </div>
  );
}
