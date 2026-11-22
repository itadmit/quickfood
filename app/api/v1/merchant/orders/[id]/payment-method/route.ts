import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  payment_method: z.enum(["cash", "card"]),
});

/**
 * Switch an order's intended payment method. Only legal while
 * `paymentStatus = pending` - once a payment has settled we don't let the
 * cashier rewrite history. Used by the POS payment sheet when the
 * cashier rings up cash but the customer then asks to pay by card (or
 * vice versa), and by the dashboard order drawer when a customer calls
 * to switch. The order status is never touched, so the order stays
 * active - no cancel + recreate. Switching to card returns `pay_url`
 * (the existing customer pay page) for the merchant to send over; no
 * charge happens here.
 */
export const POST = handler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = Schema.parse(await req.json());

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      tenantId: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      tenant: { select: { slug: true } },
    },
  });
  if (!order || order.tenantId !== session.tenantId) {
    return apiError("not_found", "הזמנה לא נמצאה", 404);
  }
  if (order.paymentStatus !== "pending") {
    return apiError("already_settled", "ההזמנה כבר שולמה", 409);
  }
  if (order.status === "cancelled" || order.status === "refunded") {
    return apiError("order_closed", "לא ניתן לשנות אמצעי תשלום בהזמנה שבוטלה", 409);
  }

  if (order.paymentMethod !== body.payment_method) {
    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { paymentMethod: body.payment_method },
      }),
      prisma.orderEvent.create({
        data: {
          orderId: id,
          type: "payment_method_changed",
          payload: {
            from: order.paymentMethod,
            to: body.payment_method,
            changed_by: session.userId,
          } as unknown as Prisma.InputJsonValue,
        },
      }),
    ]);
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
  return apiJson({
    ok: true,
    payment_method: body.payment_method,
    pay_url: body.payment_method === "card" ? `${base}/s/${order.tenant.slug}/pay/${id}` : null,
  });
});
