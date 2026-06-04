import { z } from "zod";
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
 * `paymentStatus = pending` — once a payment has settled we don't let the
 * cashier rewrite history. Used by the POS payment sheet when the
 * cashier rings up cash but the customer then asks to pay by card (or
 * vice versa).
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
    select: { id: true, tenantId: true, paymentStatus: true },
  });
  if (!order || order.tenantId !== session.tenantId) {
    return apiError("not_found", "הזמנה לא נמצאה", 404);
  }
  if (order.paymentStatus !== "pending") {
    return apiError("already_settled", "ההזמנה כבר שולמה", 409);
  }

  await prisma.order.update({
    where: { id },
    data: { paymentMethod: body.payment_method },
  });

  return apiJson({ ok: true });
});
