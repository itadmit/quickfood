import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { ORDER_INCLUDE, serializeOrder } from "@/lib/orders-serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, tenantId: session.tenantId },
    include: ORDER_INCLUDE,
  });
  if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

  return apiJson({ order: serializeOrder(order) });
});
