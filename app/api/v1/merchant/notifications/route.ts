import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { fullName } from "@/lib/format";
import { HIDE_UNPAID_NONCASH } from "@/lib/orders-visible";

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
      where: {
        tenantId: session.tenantId,
        status: { in: ["pending", "confirmed"] },
        // Skip card-pending orders that haven't confirmed payment yet —
        // no need to notify the merchant about an order the customer
        // may still abandon at the QR screen.
        NOT: HIDE_UNPAID_NONCASH,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        number: true,
        total: true,
        createdAt: true,
        customerFirstNameSnap: true,
        customerLastNameSnap: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.webhookDelivery.findMany({
      where: { endpoint: { tenantId: session.tenantId }, status: { in: ["failed", "abandoned"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, eventType: true, attempts: true, responseCode: true, createdAt: true },
    }),
  ]);

  const items = [
    ...recentOrders.map((o) => {
      const name =
        fullName(o.customer?.firstName, o.customer?.lastName) ||
        fullName(o.customerFirstNameSnap, o.customerLastNameSnap) ||
        "אורח";
      return {
        id: `order:${o.id}`,
        type: "order_new" as const,
        title: "הזמנה חדשה",
        body: `#${o.number} · ${name} · ₪${o.total}`,
        href: `/dashboard/orders`,
        created_at: o.createdAt.toISOString(),
        unread: true,
      };
    }),
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
