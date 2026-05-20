import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { SettingsTabs } from "../SettingsTabs";
import { WebhooksManager } from "./WebhooksManager";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    redirect("/dashboard/login");
  }
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
  });
  const recentDeliveries = await prisma.webhookDelivery.findMany({
    where: { endpoint: { tenantId: session.tenantId } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      endpointId: true,
      eventType: true,
      status: true,
      attempts: true,
      responseCode: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-sm text-qf-mute">ניהול הגדרות העסק והאפליקציה</p>
      </header>
      <SettingsTabs />
      <WebhooksManager
        initial={endpoints.map((e) => ({
          id: e.id,
          url: e.url,
          events: e.events,
          active: e.active,
          createdAt: e.createdAt.toISOString(),
        }))}
        deliveries={recentDeliveries.map((d) => ({
          id: d.id,
          endpointId: d.endpointId,
          eventType: d.eventType,
          status: d.status,
          attempts: d.attempts,
          responseCode: d.responseCode,
          createdAt: d.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
