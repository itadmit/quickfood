/**
 * Switch an active platform subscription between ₪299 + 0.5% (base) and
 * ₪450 zero-commission.
 *
 * The hub schedules the change for the end of the current period (no
 * proration): the merchant keeps the current plan, and its commission
 * rule, until renewal. The renewal's `subscription.updated` webhook then
 * moves Tenant.planId. The hub can't undo a scheduled change, so a second
 * switch while one is pending is refused.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import {
  getSubscription,
  patchSubscription,
  BillingHubError,
} from "@/lib/billing-hub/client";
import {
  activeIntroPrice,
  parsePlatformPlan,
  platformPlanCode,
  platformPlanOf,
} from "@/lib/billing-hub/plans";
import { rememberNoCommissionHubPlanId } from "@/lib/billing-hub/plan-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  const target = parsePlatformPlan(body.plan);
  if (!target) return apiError("invalid_plan", "מסלול לא מוכר", 400);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      id: true,
      planId: true,
      billingSubscriptionId: true,
      introMonthlyPrice: true,
      introPriceUntil: true,
    },
  });
  if (!tenant) return apiError("not_found", "tenant not found", 404);
  if (!tenant.billingSubscriptionId) {
    return apiError("no_subscription", "אין מנוי פעיל. בוחרים מסלול בהשלמת התשלום", 409);
  }
  if (platformPlanOf(tenant) === target) {
    return apiError("same_plan", "זה כבר המסלול הנוכחי", 409);
  }
  // The intro override bills at every renewal regardless of plan, so a
  // switch would carry it onto the other plan's price.
  if (activeIntroPrice(tenant) != null) {
    return apiError(
      "intro_price_active",
      "יש מחיר היכרות פעיל על המנוי. למעבר מסלול צריך לפנות לתמיכה",
      409,
    );
  }

  try {
    const sub = await getSubscription(tenant.billingSubscriptionId);
    if (sub.cancel_at_period_end) {
      return apiError("cancel_scheduled", "המנוי מסומן לסיום. קודם מבטלים את הביטול", 409);
    }
    if (sub.pending_plan_id && sub.pending_plan_id !== sub.plan_id) {
      return apiError(
        "change_pending",
        "כבר מתוזמן מעבר מסלול לסוף התקופה. לשינוי צריך לפנות לתמיכה",
        409,
      );
    }

    const result = await patchSubscription(tenant.billingSubscriptionId, {
      plan_code: platformPlanCode(target),
    });
    // The pending id is the hub id of the target plan: keep it so the
    // renewal webhook (new_plan_id only) can be mapped back.
    if (target === "no_commission" && result.pending_plan_id) {
      await rememberNoCommissionHubPlanId(result.pending_plan_id);
    }
    return apiJson({
      pending_plan: target,
      effective_at: result.current_period_end,
    });
  } catch (err) {
    if (err instanceof BillingHubError) {
      return apiError(err.code ?? "billing_failed", err.message, err.status);
    }
    throw err;
  }
});
