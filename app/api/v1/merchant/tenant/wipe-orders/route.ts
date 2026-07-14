import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { voidCommissions, BillingHubError } from "@/lib/billing-hub/client";

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
 * Commissions the hub already recorded for these orders are voided via
 * POST /commissions/void (pending ones only - anything already on an
 * issued invoice is skipped by the hub and needs a human). Best-effort:
 * a hub hiccup doesn't fail the wipe.
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
    select: { name: true, billingCustomerId: true },
  });
  if (!tenant) return apiError("not_found", "החנות לא נמצאה", 404);

  if (parsed.data.confirm_name.trim() !== tenant.name) {
    return apiError("bad_confirm", "השם שהוקלד לא תואם לשם החנות", 400);
  }

  const tenantId = session.tenantId;

  // Order ids are the hub's source_external_id - captured before the wipe
  // so the commission void can run after the rows are gone.
  const orderIds = (
    await prisma.order.findMany({ where: { tenantId }, select: { id: true } })
  ).map((o) => o.id);

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

  let commissionsVoided = 0;
  if (tenant.billingCustomerId && orderIds.length > 0) {
    for (let i = 0; i < orderIds.length; i += 1000) {
      try {
        const res = await voidCommissions({
          customer_id: tenant.billingCustomerId,
          source_external_ids: orderIds.slice(i, i + 1000),
        });
        commissionsVoided += res.voided;
      } catch (err) {
        if (err instanceof BillingHubError) {
          console.warn("[wipe-orders] commission void failed", err.status, err.message);
        } else {
          console.warn("[wipe-orders] commission void threw", err);
        }
      }
    }
  }

  return apiJson({
    ok: true,
    deleted: summary,
    commissions_voided: commissionsVoided,
  });
});
