import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireCourier } from "@/lib/auth/courier-session";
import { prisma } from "@/lib/db/client";
import { advanceStatus, OrderTransitionError } from "@/lib/orders";
import { notifyCustomerDelivered } from "@/lib/courier/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  cash_collected: z.number().int().min(0).max(100000).optional(),
  proof_photo_url: z.string().url().max(500).optional(),
});

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireCourier();
    const { id } = await params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: { courierId: true, status: true },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
    if (order.courierId !== session.courierId) {
      return apiError("forbidden", "ההזמנה אינה משויכת לך", 403);
    }
    const raw = await req.text();
    const body = raw ? Body.parse(JSON.parse(raw)) : {};
    try {
      await advanceStatus(id, "delivered", {
        changedBy: `courier:${session.courierId}`,
        cashCollected: body.cash_collected,
        proofPhotoUrl: body.proof_photo_url,
      });
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
    await prisma.courier.update({
      where: { id: session.courierId },
      data: { status: "available", lastSeenAt: new Date() },
    });
    void notifyCustomerDelivered(id).catch((err) => {
      console.error("[courier] notify delivered failed", err);
    });
    return apiJson({ ok: true });
  },
);
