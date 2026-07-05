import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { PaymentProvider } from "@prisma/client";
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

export default async function PaymentsSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { acceptsCash: true, customDomain: true, defaultPaymentMethod: true },
  });
  if (!tenant) redirect("/dashboard/login");

  const config = await prisma.paymentProviderConfig.findUnique({
    where: {
      tenantId_provider: {
        tenantId: session.tenantId,
        provider: PaymentProvider.grow,
      },
    },
  });
  const creds = (config?.credentials ?? {}) as GrowCredentials;
  const settings = (config?.settings ?? {}) as GrowSettings;

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
        }}
      />
    </div>
  );
}
