/**
 * POST /api/v1/customer/orders/[id]/pay/initiate
 *
 * Initiate a payment for an order. For Grow, returns an `sdk_auth_code` that
 * the client passes to `window.growPayment.renderPaymentOptions(code)` to
 * render the inline wallet. Final state is set by Grow's S2S callback to
 * /api/payments/callback?provider=grow&tenant=<slug>.
 */

import { apiError, apiJson, handler } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { initiateOrderPayment } from "@/lib/payments/initiate-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id: orderId } = await params;

    // Visibility matches GET /customer/orders/[id]: if a logged-in customer
    // is calling, the order must be theirs. Guest orders (no customerId)
    // are reachable by anyone holding the UUID — same as the tracking page.
    const [orderOwner, session] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: { customerId: true },
      }),
      getSession(),
    ]);
    if (!orderOwner) return apiError("not_found", "הזמנה לא נמצאה", 404);
    if (
      session?.type === "customer" &&
      orderOwner.customerId &&
      orderOwner.customerId !== session.userId
    ) {
      return apiError("forbidden", "אין הרשאה להזמנה זו", 403);
    }

    const result = await initiateOrderPayment(orderId);
    if (!result.ok) {
      return apiError(result.code, result.message, result.status);
    }
    return apiJson(result.data);
  },
);
