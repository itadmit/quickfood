import { handler, apiJson, apiError } from "@/lib/api-response";
import { OrderStatusPatchSchema } from "@/lib/validate";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { advanceStatus, OrderTransitionError } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant();
    const { id } = await params;
    const body = OrderStatusPatchSchema.parse(await req.json());

    const order = await prisma.order.findUnique({ where: { id }, select: { tenantId: true } });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
    if (session.role !== "platform_admin" && order.tenantId !== session.tenantId) {
      return apiError("forbidden", "אין הרשאה", 403);
    }

    try {
      const updated = await advanceStatus(id, body.status, {
        courierId: body.courier_id,
        changedBy: session.userId,
      });
      return apiJson({ order: { id: updated.id, status: updated.status } });
    } catch (err) {
      if (err instanceof OrderTransitionError) {
        return apiError(
          "invalid_transition",
          `מעבר לא חוקי: ${err.from} ← ${err.to}`,
          409,
        );
      }
      throw err;
    }
  },
);
