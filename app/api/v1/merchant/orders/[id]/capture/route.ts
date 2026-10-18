import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { captureOrder } from "@/lib/payments/capture-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/merchant/orders/:id/capture
 *
 * Captures ("charge now") a J5 hold: the card was authorized and the amount
 * reserved at order time, and this moves the money for real. Only valid while
 * the order is in the `authorized` state. On success the order flips to paid
 * and the platform commission is recorded (it was deliberately NOT billed at
 * authorization time - a hold that's never captured must never be billed).
 *
 * The capture itself lives in lib/payments/capture-order.ts so the
 * capture-on-approval path (PATCH .../status) shares one implementation.
 * Provider support is optional: only providers that implement `capture`
 * (currently Hyp) can do this. Everything else returns a clear error.
 */
export const POST = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;

    const result = await captureOrder({ orderId: id, tenantId: session.tenantId });

    if (!result.ok) {
      if (result.code === "not_found") return apiError("not_found", result.message, 404);
      if (result.code === "unsupported") {
        return apiError("capture_unsupported", result.message, 400);
      }
      if (result.code === "capture_failed") {
        return apiError("capture_failed", result.message, 400);
      }
      // already_paid / not_authorized / no_auth_txn are all state conflicts.
      return apiError("conflict", result.message, 409);
    }

    return apiJson({ ok: true, amount: result.amount });
  },
);
