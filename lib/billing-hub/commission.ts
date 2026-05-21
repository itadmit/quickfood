/**
 * Record a transaction commission on the QuickBilling Hub.
 *
 * Called when an order completes (status → delivered). The hub computes
 * 0.5% × `amount` and aggregates into the end-of-month commission invoice
 * charged from the tenant's saved token. We send the order's id as the
 * idempotency key so retries can't double-record.
 *
 * Best-effort: order completion shouldn't fail just because the billing hub
 * is briefly unreachable.
 */
import { prisma } from "@/lib/db/client";
import { recordCommission, BillingHubError } from "@/lib/billing-hub/client";

const COMMISSION_RATE = 0.005; // 0.5%

export async function recordOrderCommission(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      total: true,
      deliveredAt: true,
      createdAt: true,
      tenant: {
        select: { billingCustomerId: true, billingSubscriptionId: true },
      },
    },
  });
  if (!order) return;
  if (!order.tenant.billingCustomerId) {
    // Tenant hasn't completed billing setup; nothing to record yet.
    return;
  }
  if (order.total <= 0) return;

  // Use the delivered-at day as the commission's period boundary. The hub
  // aggregates by period_end into the same month's invoice.
  const occurredAt = order.deliveredAt ?? order.createdAt;
  const isoDate = occurredAt.toISOString().slice(0, 10);

  try {
    await recordCommission({
      customer_id: order.tenant.billingCustomerId,
      subscription_id: order.tenant.billingSubscriptionId ?? undefined,
      source_external_id: order.id,
      idempotency_key: `order:${order.id}`,
      amount: order.total,
      fee_rate: COMMISSION_RATE,
      period_start: isoDate,
      period_end: isoDate,
    });
  } catch (err) {
    if (err instanceof BillingHubError) {
      console.warn(
        "[commission] hub call failed",
        err.status,
        err.code,
        err.message,
      );
    } else {
      console.warn("[commission] threw", err);
    }
  }
}
