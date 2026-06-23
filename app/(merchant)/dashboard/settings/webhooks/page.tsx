import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { IcoImport, IcoArrowLeft } from "@/components/shared/Icons";
import { SettingsHeader } from "../SettingsHeader";
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
      <SettingsHeader subtitle="חיבור POS, מדפסות ומערכות חיצוניות" />

      <Link
        href="/download"
        className="flex items-center gap-4 bg-qf-blue-soft border border-qf-blue/30 rounded-2xl p-4 hover:border-qf-blue/60 transition"
      >
        <span className="shrink-0 w-11 h-11 rounded-xl bg-white border border-qf-blue/30 flex items-center justify-center">
          <IcoImport c="var(--color-qf-blue)" s={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-qf-ink">אפליקציית עמדת קופה</span>
          <span className="block text-sm text-qf-ink2">הורידו את QuickFood ל-Windows, macOS או Android — קיוסק או לוח בקרה במסך מלא.</span>
        </span>
        <IcoArrowLeft c="var(--color-qf-blue)" s={18} />
      </Link>

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
