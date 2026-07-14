import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/merchant/tenant/wipe-orders
 *
 * Deletes EVERY order of the store and restarts the order numbering from
 * 1. Built for the test-order ritual: the merchant places a few trial
 * orders to see the customer flow, then wants a clean slate before going
 * live so the history holds only real orders.
 *
 * Order children (items, status events, reviews, payment transactions)
 * go with the FK cascade; pending Grow payments and kiosk pending
 * checkouts are cleared explicitly since they reference orders without a
 * cascading FK. Menu, customers, team, billing setup - untouched.
 *
 * NOTE: commissions already recorded on the billing hub for delivered
 * test orders are hub-side and are NOT reversed here - the UI says to
 * run test orders before connecting billing.
 *
 * Confirm token = the tenant's exact name (same UX as store reset).
 * Owner role required.
 */

const BodySchema = z.object({
  confirm_name: z.string().min(1),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError("bad_request", "אישור חסר", 400);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true },
  });
  if (!tenant) return apiError("not_found", "החנות לא נמצאה", 404);

  if (parsed.data.confirm_name.trim() !== tenant.name) {
    return apiError("bad_confirm", "השם שהוקלד לא תואם לשם החנות", 400);
  }

  const tenantId = session.tenantId;

  const summary = await prisma.$transaction(
    async (tx) => {
      const pendingPayments = await tx.pendingPayment.deleteMany({ where: { tenantId } });
      const kioskCheckouts = await tx.kioskPendingCheckout.deleteMany({ where: { tenantId } });
      const orders = await tx.order.deleteMany({ where: { tenantId } });
      await tx.tenant.update({
        where: { id: tenantId },
        data: { nextOrderNumber: 1 },
      });
      return {
        orders: orders.count,
        pending_payments: pendingPayments.count,
        kiosk_checkouts: kioskCheckouts.count,
      };
    },
    { timeout: 60_000 },
  );

  return apiJson({ ok: true, deleted: summary });
});
