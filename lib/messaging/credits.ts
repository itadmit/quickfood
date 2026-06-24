import { prisma } from "@/lib/db/client";

/**
 * Per-tenant messaging balances. SMS and BYO-WhatsApp keep SEPARATE pools.
 * QuickFood owns the meter: every paid send reserves from its channel's pool.
 * Merchants top each up via the Billing Hub.
 *
 * reserve is atomic (conditional decrement) so a parallel broadcast batch can't
 * oversend past zero. Refund on rail failure so we only charge for accepted
 * messages. (Marketing SMS goes through Poply, which is metered here; WhatsApp
 * sends meter themselves inside lib/whatsapp/send.ts.)
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

export async function getWhatsappCredits(tenantId: string): Promise<number> {
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { whatsappCreditsRemaining: true },
  });
  return t?.whatsappCreditsRemaining ?? 0;
}
