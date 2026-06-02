/**
 * Schedule the managed-WhatsApp reviews add-on to cancel at the end of the
 * current billing period. The tenant keeps unlimited sends until the period
 * end; on `subscription.cancelled` the webhook clears the mirror id and the
 * channel falls back to the merchant's selection (off/email/sms/whatsapp).
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
    select: { reviewsWhatsappSubscriptionId: true },
  });
  if (!tenant?.reviewsWhatsappSubscriptionId) {
    return apiError(
      "no_subscription",
      "אין מנוי ווטסאפ ביקורות לביטול",
      409,
    );
  }

  try {
    const result = await cancelSubscription(
      tenant.reviewsWhatsappSubscriptionId,
      { at_period_end: true, reason: body.reason },
    );
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
