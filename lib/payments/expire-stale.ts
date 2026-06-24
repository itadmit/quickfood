/**
 * Housekeeping: flip abandoned PendingPayment rows from `pending` to `expired`.
 *
 * A PendingPayment is created when checkout calls /pay/initiate and is meant to
 * live only until the S2S callback confirms it or the provider link lapses
 * (~10 min for Grow). When the customer never completes payment no callback
 * arrives, so the row sits at `pending` forever and clutters the merchant's
 * payments view. This sweep closes out the ones whose `expiresAt` has passed
 * (or, when null, that are older than 30 min). Rows that already carry a
 * transaction got a callback and are left untouched.
 */
import { prisma } from "@/lib/db/client";

const STALE_MS = 30 * 60 * 1000;

export async function expireStalePendingPayments(): Promise<number> {
  const now = new Date();
  const res = await prisma.pendingPayment.updateMany({
    where: {
      status: "pending",
      transactions: { none: {} },
      OR: [
        { expiresAt: { lt: now } },
        { expiresAt: null, createdAt: { lt: new Date(now.getTime() - STALE_MS) } },
      ],
    },
    data: { status: "expired" },
  });
  return res.count;
}
