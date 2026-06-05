import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id },
    include: { endpoint: true },
  });
  if (!delivery) return apiError("not_found", "delivery not found", 404);
  if (delivery.endpoint.tenantId !== session.tenantId)
    return apiError("forbidden", "אין הרשאה", 403);

  await prisma.webhookDelivery.update({
    where: { id },
    data: {
      status: "pending",
      nextRetryAt: new Date(),
    },
  });

  // The cron worker will pick this up - alternatively we could call
  // attemptDelivery directly here for instant retry.
  return apiJson({ ok: true });
});
