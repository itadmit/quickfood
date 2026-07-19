/**
 * Points math for the loyalty club.
 *
 * EARNED points are never stored - they're a deterministic fold over the
 * customer's accepted orders in chronological order: each order earns at the
 * rate of the tier the member held BEFORE that order, and the running total
 * upgrades the tier as thresholds pass. Rerunning history always yields the
 * same number, so there's nothing to backfill and nothing to drift.
 *
 * Tier is decided by LIFETIME earned points (redemptions don't demote).
 * balance = earned − Σ points of non-revoked redemptions (LoyaltyRedemption).
 */
import { prisma } from "@/lib/db/client";
import type { OrderStatus } from "@prisma/client";
import {
  earnRateForTier,
  tierForPoints,
  type LoyaltyConfig,
  type LoyaltyTier,
} from "@/lib/loyalty/config";

/** Order statuses that earn points - mirrors the dashboard revenue filter. */
export const EARNING_STATUS_FILTER: { notIn: OrderStatus[] } = {
  notIn: ["pending", "cancelled", "refunded"],
};

export interface EarnedResult {
  earned: number;
  tier: LoyaltyTier;
}

/** Chronological per-tier fold. `orders` MUST be sorted oldest-first. */
export function foldEarnedPoints(
  orders: Array<{ total: number }>,
  config: LoyaltyConfig,
): EarnedResult {
  let earned = 0;
  for (const o of orders) {
    const tier = tierForPoints(earned, config);
    earned += Math.max(0, Math.round(o.total * earnRateForTier(config, tier)));
  }
  return { earned, tier: tierForPoints(earned, config) };
}

export interface RedeemQuote {
  points: number;
  valueShekels: number;
}

/**
 * How much of the balance may be spent on an order. Value is whole shekels;
 * the points charged are the exact cost of that value (ceil, so the customer
 * never gets a shekel for fractional leftover points).
 */
export function redeemQuote(
  balancePoints: number,
  orderSubtotalShekels: number,
  config: LoyaltyConfig,
): RedeemQuote {
  const r = config.redemption;
  if (!r.enabled || balancePoints < r.minPoints || balancePoints <= 0) {
    return { points: 0, valueShekels: 0 };
  }
  const balanceValue = Math.floor((balancePoints * r.pointValueAgorot) / 100);
  const cap = Math.floor((orderSubtotalShekels * r.maxPercentOfOrder) / 100);
  const valueShekels = Math.max(0, Math.min(balanceValue, cap));
  if (valueShekels === 0) return { points: 0, valueShekels: 0 };
  const points = Math.ceil((valueShekels * 100) / r.pointValueAgorot);
  return { points, valueShekels };
}

export interface LoyaltyBalance {
  earned: number;
  redeemed: number;
  balance: number;
  tier: LoyaltyTier;
}

/** Full balance snapshot for one customer at one tenant. */
export async function loadLoyaltyBalance(
  tenantId: string,
  customerId: string,
  config: LoyaltyConfig,
): Promise<LoyaltyBalance> {
  const [orders, redemptionAgg] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId, customerId, status: EARNING_STATUS_FILTER },
      orderBy: { createdAt: "asc" },
      select: { total: true },
    }),
    prisma.loyaltyRedemption.aggregate({
      where: { tenantId, customerId, revokedAt: null },
      _sum: { points: true },
    }),
  ]);
  const { earned, tier } = foldEarnedPoints(orders, config);
  const redeemed = redemptionAgg._sum.points ?? 0;
  return { earned, redeemed, balance: Math.max(0, earned - redeemed), tier };
}
