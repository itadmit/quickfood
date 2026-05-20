import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * For MVP we synthesize the notification feed from existing data:
 *  - latest orders (status pending/confirmed/preparing ← "הזמנה חדשה")
 *  - latest failed webhook deliveries ← "webhook נכשל"
 *  - latest cancelled orders ← "הזמנה בוטלה"
 *
 * A real notification engine (Notification table per recipient) can replace
 * this without touching the UI.
 */
export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const [recentOrders, failedDeliveries] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId: session.tenantId, status: { in: ["pending", "confirmed"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, number: true, total: true, createdAt: true, customerNameSnap: true, customer: { select: { name: true } } },
    }),
    prisma.webhookDelivery.findMany({
      where: { endpoint: { tenantId: session.tenantId }, status: { in: ["failed", "abandoned"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, eventType: true, attempts: true, responseCode: true, createdAt: true },
    }),
  ]);

  const items = [
    ...recentOrders.map((o) => ({
      id: `order:${o.id}`,
      type: "order_new" as const,
      title: "הזמנה חדשה",
      body: `#${o.number} · ${o.customer?.name || o.customerNameSnap || "אורח"} · ₪${o.total}`,
      href: `/dashboard/orders`,
      created_at: o.createdAt.toISOString(),
      unread: true,
    })),
    ...failedDeliveries.map((d) => ({
      id: `webhook:${d.id}`,
      type: "webhook_failed" as const,
      title: "Webhook נכשל",
      body: `${d.eventType} · ${d.attempts} ניסיונות${d.responseCode ? ` · ${d.responseCode}` : ""}`,
      href: `/dashboard/settings/webhooks`,
      created_at: d.createdAt.toISOString(),
      unread: true,
    })),
  ].sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

  return apiJson({ notifications: items.slice(0, 20), unread_count: items.length });
});
