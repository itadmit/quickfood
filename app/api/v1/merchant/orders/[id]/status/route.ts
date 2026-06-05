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

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        tenantId: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
      },
    });
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
    if (session.role !== "platform_admin" && order.tenantId !== session.tenantId) {
      return apiError("forbidden", "אין הרשאה", 403);
    }

    if (body.courier_id) {
      const courier = await prisma.courier.findUnique({
        where: { id: body.courier_id },
        select: { tenantId: true, pinHash: true, active: true },
      });
      if (!courier || courier.tenantId !== order.tenantId) {
        return apiError("validation_error", "השליח אינו שייך למסעדה", 422, "courier_id");
      }
      if (!courier.active) {
        return apiError("validation_error", "השליח מושבת", 422, "courier_id");
      }
      if (!courier.pinHash) {
        return apiError(
          "courier_not_configured",
          "השליח עדיין לא הגדיר חשבון התחברות. עברו למסך השליחים והשלימו מייל + PIN.",
          422,
          "courier_id",
        );
      }
    }

    try {
      const updated = await advanceStatus(id, body.status, {
        courierId: body.courier_id,
        changedBy: session.userId,
      });

      // Implicit "cash collected" - when a cash order moves from
      // pending → confirmed, the merchant is acknowledging they took
      // the cash at the counter (kiosk flow). Flip paymentStatus to
      // paid in the same call so the order surfaces as fully settled.
      // Card-pending orders confirmed manually (Grow callback lost)
      // are left as paymentStatus=pending - payment didn't actually
      // happen, the merchant accepted on good faith.
      if (
        order.status === "pending" &&
        body.status === "confirmed" &&
        order.paymentMethod === "cash" &&
        order.paymentStatus !== "paid"
      ) {
        await prisma.order.update({
          where: { id },
          data: { paymentStatus: "paid" },
        });
      }

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
