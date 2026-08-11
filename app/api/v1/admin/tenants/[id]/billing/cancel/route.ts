/**
 * Admin: stop a tenant's platform subscription (so the NEXT cycle isn't charged)
 * and schedule their store to close at the end of the paid period. One action
 * for "a client wants to shut down": cancel the base subscription at period end
 * + set scheduledCloseAt so the store stays open until then and the daily
 * close-scheduled-tenants job suspends it exactly at period end.
 *
 * Cancelling is best-effort: a tenant with no active subscription (trial / never
 * paid) has no paid period to wait out, so it's suspended immediately.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { cancelSubscription, BillingHubError } from "@/lib/billing-hub/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string };

  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { id: true, billingSubscriptionId: true },
  });
  if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);

  let subscriptionCancelled = false;
  let currentPeriodEnd: string | null = null;
  if (tenant.billingSubscriptionId) {
    try {
      const result = await cancelSubscription(tenant.billingSubscriptionId, {
        at_period_end: true,
        reason: body.reason || "admin_cancel",
      });
      subscriptionCancelled = true;
      currentPeriodEnd = result.current_period_end ?? null;
    } catch (err) {
      if (err instanceof BillingHubError) {
        return apiError(err.code ?? "billing_failed", err.message, err.status);
      }
      throw err;
    }
  }

  const closeAt = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const scheduled = !!closeAt && !Number.isNaN(closeAt.getTime()) && closeAt > new Date();

  if (scheduled) {
    await prisma.tenant.update({
      where: { id },
      data: { scheduledCloseAt: closeAt },
    });
  } else {
    await prisma.tenant.update({
      where: { id },
      data: { status: "suspended", scheduledCloseAt: null },
    });
  }

  return apiJson({
    subscription_cancelled: subscriptionCancelled,
    had_subscription: !!tenant.billingSubscriptionId,
    current_period_end: currentPeriodEnd,
    scheduled_close_at: scheduled ? closeAt!.toISOString() : null,
    suspended_now: !scheduled,
  });
});
