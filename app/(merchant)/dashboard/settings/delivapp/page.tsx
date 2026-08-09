import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { SettingsHeader } from "../SettingsHeader";
import { DelivAppForm } from "./DelivAppForm";
import { resolveDelivAppConfig } from "@/lib/delivapp/config";

export const dynamic = "force-dynamic";

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://app.quickfood.co.il"
  );
}

export default async function DelivAppSettingsPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { delivAppConfig: true },
  });
  if (!tenant) redirect("/dashboard/login");

  const raw =
    tenant.delivAppConfig && typeof tenant.delivAppConfig === "object"
      ? (tenant.delivAppConfig as Record<string, unknown>)
      : {};
  const token = typeof raw.inboundToken === "string" ? raw.inboundToken : "";

  return (
    <div className="space-y-5">
      <SettingsHeader subtitle="שליחת הזמנות משלוח לאפליקציית DelivApp" />
      <DelivAppForm
        initial={{
          enabled: raw.enabled === true,
          restId: typeof raw.restId === "string" ? raw.restId : "",
          appId: typeof raw.appId === "string" ? raw.appId : "",
          apiKeySet: typeof raw.apiKey === "string" && raw.apiKey.length > 0,
          webhookUrl: token
            ? `${appBaseUrl()}/api/v1/integrations/delivapp/callback?token=${token}`
            : null,
          connected: !!resolveDelivAppConfig(tenant.delivAppConfig),
        }}
      />
    </div>
  );
}
