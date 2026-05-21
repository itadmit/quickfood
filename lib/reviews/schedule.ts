/**
 * Schedule a review reminder for an order via QStash.
 *
 * Called from `advanceStatus(order, "delivered")`. We delay by the tenant's
 * `reviewsDelayMinutes`. If reviews are disabled or the channel is `off`,
 * we skip scheduling — but we don't error: a status transition shouldn't
 * fail just because reminders are off.
 */
import { prisma } from "@/lib/db/client";
import { publish } from "@/lib/qstash/client";

export async function scheduleReviewReminder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      tenant: {
        select: {
          reviewsEnabled: true,
          reviewsChannel: true,
          reviewsDelayMinutes: true,
        },
      },
    },
  });
  if (!order) return;
  if (!order.customerId) return; // guest orders can't be reminded
  const { reviewsEnabled, reviewsChannel, reviewsDelayMinutes } = order.tenant;
  if (!reviewsEnabled) return;
  if (reviewsChannel === "off") return;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${base.replace(/\/$/, "")}/api/_internal/jobs/send-review-reminder`;

  // QStash dedupes by Upstash-Deduplication-Id within retention; pair it with
  // the order id so a re-fired "delivered" event doesn't double-schedule.
  await publish({
    url,
    body: { orderId: order.id },
    delay: Math.max(60, reviewsDelayMinutes * 60),
    deduplicationId: `review-reminder:${order.id}`,
  });
}
