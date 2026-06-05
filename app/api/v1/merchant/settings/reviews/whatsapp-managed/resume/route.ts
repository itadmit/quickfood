/**
 * Undo a scheduled "cancel at period end" on the managed-WhatsApp reviews
 * add-on while it is still active - the merchant changed their mind.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { patchSubscription, BillingHubError } from "@/lib/billing-hub/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const session = await requireMerchant(["owner"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { reviewsWhatsappSubscriptionId: true },
  });
  if (!tenant?.reviewsWhatsappSubscriptionId) {
    return apiError(
      "no_subscription",
      "אין מנוי ווטסאפ ביקורות לבטל את הביטול שלו",
      409,
    );
  }

  try {
    const result = await patchSubscription(
      tenant.reviewsWhatsappSubscriptionId,
      { cancel_at_period_end: false },
    );
    return apiJson({
      status: result.status,
      cancel_at_period_end: result.cancel_at_period_end,
      current_period_end: result.current_period_end,
    });
  } catch (err) {
    if (err instanceof BillingHubError) {
      return apiError(err.code ?? "billing_failed", err.message, err.status);
    }
    throw err;
  }
});
