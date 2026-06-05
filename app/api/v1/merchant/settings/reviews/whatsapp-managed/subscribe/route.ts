/**
 * Subscribe the tenant to the managed-WhatsApp reviews add-on
 * (`quickfood_reviews_whatsapp` - ₪99/mo + VAT, unlimited sends via the
 * platform iBot account, no SMS-credit deduction).
 *
 * Requires that the tenant has already completed billing setup (saved card on
 * the QuickBilling Hub). We mirror the returned subscription id immediately;
 * the webhook handler ALSO mirrors it on `subscription.created`, so a crash
 * between the hub call and the local update still converges.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { createSubscription, BillingHubError } from "@/lib/billing-hub/client";
import { REVIEWS_WHATSAPP_PLAN_CODE } from "@/lib/billing-hub/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      id: true,
      billingCustomerId: true,
      billingPaymentMethodId: true,
      reviewsWhatsappSubscriptionId: true,
    },
  });
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  if (tenant.reviewsWhatsappSubscriptionId) {
    return apiError(
      "already_subscribed",
      "מנוי ווטסאפ ביקורות כבר פעיל",
      409,
    );
  }

  if (!tenant.billingCustomerId || !tenant.billingPaymentMethodId) {
    return apiError(
      "billing_setup_required",
      "יש להשלים הגדרת חיוב לפני הפעלת מנוי ווטסאפ ביקורות",
      409,
    );
  }

  try {
    const sub = await createSubscription({
      customer_id: tenant.billingCustomerId,
      plan_code: REVIEWS_WHATSAPP_PLAN_CODE,
      billing_interval: "monthly",
      payment_method_id: tenant.billingPaymentMethodId,
      metadata: {
        tenant_id: tenant.id,
        kind: "reviews_whatsapp",
      },
    });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { reviewsWhatsappSubscriptionId: sub.id },
    });

    return apiJson({
      subscription_id: sub.id,
      status: sub.status,
      current_period_end: sub.current_period_end,
    });
  } catch (err) {
    if (err instanceof BillingHubError) {
      return apiError(err.code ?? "billing_failed", err.message, err.status);
    }
    throw err;
  }
});
