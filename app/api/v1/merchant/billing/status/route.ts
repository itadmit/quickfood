/**
 * Lightweight polling endpoint for the billing dashboard.
 *
 * Returns just the flags the BillingView needs to know whether the
 * post-tokenization webhook has landed: `payment_method` (is there a
 * saved token?) and `setup_complete` (did the webhook flip the
 * billingSetupCompletedAt timestamp?). The BillingView polls this every
 * couple of seconds after the merchant returns from Grow so the UI
 * flips to "active" without a manual refresh.
 */
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      billingPaymentMethodId: true,
      billingSetupCompletedAt: true,
    },
  });
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  return apiJson({
    payment_method: !!tenant.billingPaymentMethodId,
    setup_complete: !!tenant.billingSetupCompletedAt,
  });
});
