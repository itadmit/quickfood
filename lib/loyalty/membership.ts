import { prisma } from "@/lib/db/client";
import type { LoyaltyJoinSource } from "@prisma/client";

/**
 * Idempotently enrol a customer into a tenant's loyalty club. Safe to call on
 * every qualifying order - the (tenantId, customerId) unique row means a
 * returning member is a no-op except for flipping marketingConsent to true.
 * marketingConsent is sticky-true: an explicit yes never gets written back to
 * false here (mirrors Customer.marketingConsent / unsubscribe is the off-ramp).
 * Never throws - membership must never block the order or join flow.
 */
export async function ensureLoyaltyMember(input: {
  tenantId: string;
  customerId: string;
  joinSource: LoyaltyJoinSource;
  marketingConsent: boolean;
}): Promise<void> {
  try {
    await prisma.loyaltyMember.upsert({
      where: {
        tenantId_customerId: {
          tenantId: input.tenantId,
          customerId: input.customerId,
        },
      },
      create: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        joinSource: input.joinSource,
        marketingConsent: input.marketingConsent,
      },
      update: input.marketingConsent ? { marketingConsent: true } : {},
    });
    if (input.marketingConsent) {
      await prisma.customer
        .update({
          where: { id: input.customerId },
          data: { marketingConsent: true },
        })
        .catch(() => {});
    }
  } catch (err) {
    console.warn("[loyalty] ensureLoyaltyMember failed", err);
  }
}
