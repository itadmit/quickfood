import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { alertMerchantNewOrder } from "@/lib/orders/notify-merchant";
import { publishOrderCreated } from "@/lib/realtime/worker";
import { printOrderTicket } from "@/lib/printing/print-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const [order, session] = await Promise.all([
      prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          number: true,
          total: true,
          method: true,
          status: true,
          source: true,
          tenantId: true,
          customerId: true,
          paymentMethod: true,
          paymentStatus: true,
          tenant: { select: { acceptsCash: true } },
          items: { select: { nameSnapshot: true, quantity: true, totalPrice: true, sizeSnapshot: true } },
        },
      }),
      getSession(),
    ]);
    if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
    if (session?.type === "customer" && order.customerId && order.customerId !== session.userId) {
      return apiError("forbidden", "אין הרשאה להזמנה זו", 403);
    }
    if (!order.tenant.acceptsCash || order.source === "kiosk" || order.source === "pos") {
      return apiError("cash_unavailable", "תשלום במזומן לא זמין בהזמנה זו", 409);
    }
    if (order.paymentStatus !== "pending") {
      return apiError("already_settled", "ההזמנה כבר שולמה", 409);
    }
    if (order.status !== "pending") {
      return apiError("order_closed", "לא ניתן לשנות אמצעי תשלום בהזמנה הזו", 409);
    }
    if (order.paymentMethod === "cash") return apiJson({ ok: true });

    const switched = await prisma.order.updateMany({
      where: { id, paymentMethod: order.paymentMethod, paymentStatus: "pending", status: "pending" },
      data: { paymentMethod: "cash" },
    });
    if (switched.count === 0) return apiJson({ ok: true });

    await prisma.orderEvent.create({
      data: {
        orderId: id,
        type: "payment_method_changed",
        payload: {
          from: order.paymentMethod,
          to: "cash",
          changed_by: "customer",
        } as unknown as Prisma.InputJsonValue,
      },
    });

    publishOrderCreated(order.tenantId, { id, number: order.number, status: "pending" });
    void dispatchWebhook({
      tenantId: order.tenantId,
      eventType: "order.created",
      payload: {
        order_id: id,
        number: order.number,
        total: order.total,
        method: order.method,
        items: order.items.map((it) => ({
          name: it.nameSnapshot,
          quantity: it.quantity,
          total: it.totalPrice,
          size: it.sizeSnapshot,
        })),
      },
    });
    after(() => alertMerchantNewOrder(id));
    after(() => printOrderTicket(id, "cash_created"));

    return apiJson({ ok: true });
  },
);
