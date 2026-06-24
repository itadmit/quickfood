/**
 * Customer-facing loyalty snapshot for the storefront personal area. Mirrors
 * the merchant-side math (lib/loyalty/members.ts): points are derived from the
 * sum of the customer's non-cancelled order totals × pointsPerShekel, never
 * stored, so the figure the customer sees matches the merchant's dashboard.
 */
import { prisma } from "@/lib/db/client";
import {
  resolveLoyaltyConfig,
  pointsForSpend,
  tierForPoints,
  LOYALTY_TIERS,
  type LoyaltyTier,
} from "@/lib/loyalty/config";

export interface CustomerLoyalty {
  points: number;
  tier: LoyaltyTier;
  tierName: string;
  nextTierName: string | null;
  pointsToNext: number;
  progressPct: number;
}

export async function getCustomerLoyalty(
  tenantId: string,
  customerId: string,
): Promise<CustomerLoyalty> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { loyaltyConfig: true },
  });
  const config = resolveLoyaltyConfig(tenant?.loyaltyConfig);

  const agg = await prisma.order.aggregate({
    where: { tenantId, customerId, status: { notIn: ["pending", "cancelled", "refunded"] } },
    _sum: { total: true },
  });

  const spent = agg._sum.total ?? 0;
  const points = pointsForSpend(spent, config);
  const tier = tierForPoints(points, config);

  const idx = LOYALTY_TIERS.indexOf(tier);
  const nextTier =
    idx >= 0 && idx < LOYALTY_TIERS.length - 1 ? LOYALTY_TIERS[idx + 1] : null;

  const currentMin = config.tiers[tier].minPoints;
  const nextMin = nextTier ? config.tiers[nextTier].minPoints : currentMin;
  const span = nextMin - currentMin;
  const pointsToNext = nextTier ? Math.max(0, nextMin - points) : 0;
  const progressPct =
    nextTier && span > 0
      ? Math.min(100, Math.max(0, Math.round(((points - currentMin) / span) * 100)))
      : 100;

  return {
    points,
    tier,
    tierName: config.tiers[tier].name,
    nextTierName: nextTier ? config.tiers[nextTier].name : null,
    pointsToNext,
    progressPct,
  };
}
