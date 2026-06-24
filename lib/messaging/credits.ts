import { prisma } from "@/lib/db/client";

/**
 * The single per-tenant messaging balance. QuickFood owns the meter (Model A):
 * every paid send - transactional or marketing, over any rail (sms4free, Poply,
 * iBot) - reserves from this one pool. Merchants top it up via the Billing Hub;
 * the delivery rails' own wholesale pools are invisible to them.
 *
 * reserve is atomic (conditional decrement) so a parallel broadcast batch can't
 * oversend past zero. Refund on rail failure so we only charge for accepted
 * messages.
 */
export async function reserveSmsCredit(tenantId: string): Promise<boolean> {
  const res = await prisma.tenant.updateMany({
    where: { id: tenantId, smsCreditsRemaining: { gt: 0 } },
    data: { smsCreditsRemaining: { decrement: 1 } },
  });
  return res.count === 1;
}

export async function refundSmsCredit(tenantId: string): Promise<void> {
  await prisma.tenant
    .update({ where: { id: tenantId }, data: { smsCreditsRemaining: { increment: 1 } } })
    .catch(() => {});
}

export async function getSmsCredits(tenantId: string): Promise<number> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { smsCreditsRemaining: true },
  });
  return t?.smsCreditsRemaining ?? 0;
}
