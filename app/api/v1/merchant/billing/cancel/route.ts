/**
 * Schedule the platform subscription to cancel at the end of the current
 * billing period. We never offer the immediate-cancel path from the
 * merchant UI: a refund flow exists separately, and end-of-period gives
 * the merchant the rest of the month they already paid for.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { cancelSubscription, BillingHubError } from "@/lib/billing-hub/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = (await req.json().catch(() => ({}))) as { reason?: string };

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { billingSubscriptionId: true },
  });
  if (!tenant?.billingSubscriptionId) {
    return apiError(
      "no_subscription",
      "אין מנוי פלטפורמה פעיל לביטול",
      409,
    );
  }

  try {
    const result = await cancelSubscription(tenant.billingSubscriptionId, {
      at_period_end: true,
      reason: body.reason,
    });
    return apiJson({
      status: result.status,
      cancel_at_period_end: true,
      current_period_end: result.current_period_end,
    });
  } catch (err) {
    if (err instanceof BillingHubError) {
      return apiError(err.code ?? "billing_failed", err.message, err.status);
    }
    throw err;
  }
});
