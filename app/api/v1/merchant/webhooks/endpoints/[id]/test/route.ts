import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
  if (!endpoint || endpoint.tenantId !== session.tenantId) {
    return apiError("not_found", "endpoint not found", 404);
  }

  await dispatchWebhook({
    tenantId: session.tenantId,
    eventType: "order.created",
    payload: {
      test: true,
      message: "Test webhook from QuickFood dashboard",
      sample_order: {
        id: "test-order-id",
        number: "TEST-001",
        total: 100,
        items: [{ name: "פיצה לדוגמה", quantity: 1 }],
      },
    },
  });

  return apiJson({ ok: true, message: "Test event dispatched" });
});
