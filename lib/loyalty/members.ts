import { prisma } from "@/lib/db/client";
import {
  resolveLoyaltyConfig,
  type LoyaltyConfig,
  type LoyaltyTier,
} from "@/lib/loyalty/config";
import { foldEarnedPoints, EARNING_STATUS_FILTER } from "@/lib/loyalty/points";

export interface LoyaltyMemberRow {
  customerId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  spent: number;
  points: number;
  balance: number;
  tier: LoyaltyTier;
  orderCount: number;
  lastOrderAt: string | null;
  isMember: boolean;
  joinedAt: string | null;
  joinSource: string | null;
  marketingConsent: boolean;
}

export interface LoyaltyStats {
  totalPurchasers: number;
  totalMembers: number;
  byTier: Record<LoyaltyTier, number>;
}

export interface LoyaltyData {
  config: LoyaltyConfig;
  rows: LoyaltyMemberRow[];
  stats: LoyaltyStats;
}

/**
 * Build the merchant loyalty dashboard payload: the resolved config plus one
 * row per customer who either purchased from this tenant or joined the club.
 * Points/tier are derived from order totals (each shekel = pointsPerShekel),
 * never stored - the numbers can't drift from the order history.
 */
export async function loadLoyaltyData(
  tenantId: string,
  tenantName: string,
): Promise<LoyaltyData> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { loyaltyConfig: true },
  });
  const config = resolveLoyaltyConfig(tenant?.loyaltyConfig, tenantName);

  const [orderRows, members, redemptions] = await Promise.all([
    // Per-order rows (not an aggregate) because earned points fold
    // chronologically at the tier held per order - see lib/loyalty/points.
    prisma.order.findMany({
      where: {
        tenantId,
        customerId: { not: null },
        // Only accepted orders earn points (excludes pending awaiting approval),
        // matching the dashboard revenue filter and the customer-facing snapshot.
        status: EARNING_STATUS_FILTER,
      },
      orderBy: { createdAt: "asc" },
      select: { customerId: true, total: true, createdAt: true },
    }),
    prisma.loyaltyMember.findMany({
      where: { tenantId },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.loyaltyRedemption.groupBy({
      by: ["customerId"],
      where: { tenantId, revokedAt: null },
      _sum: { points: true },
    }),
  ]);

  const spendByCustomer = new Map<
    string,
    { spent: number; orders: number; lastOrderAt: Date | null; totals: Array<{ total: number }> }
  >();
  for (const o of orderRows) {
    if (!o.customerId) continue;
    const entry =
      spendByCustomer.get(o.customerId) ??
      { spent: 0, orders: 0, lastOrderAt: null as Date | null, totals: [] };
    entry.spent += o.total;
    entry.orders += 1;
    entry.lastOrderAt = o.createdAt;
    entry.totals.push({ total: o.total });
    spendByCustomer.set(o.customerId, entry);
  }
  const redeemedByCustomer = new Map(
    redemptions.map((r) => [r.customerId, r._sum.points ?? 0]),
  );

  const memberByCustomer = new Map(members.map((m) => [m.customerId, m]));

  const customerIds = Array.from(
    new Set<string>([...spendByCustomer.keys(), ...memberByCustomer.keys()]),
  );

  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          marketingConsent: true,
        },
      })
    : [];

  const byTier: Record<LoyaltyTier, number> = { silver: 0, gold: 0, platinum: 0 };

  const rows: LoyaltyMemberRow[] = customers.map((c) => {
    const spend = spendByCustomer.get(c.id);
    const member = memberByCustomer.get(c.id);
    const spent = spend?.spent ?? 0;
    const { earned: points, tier } = foldEarnedPoints(spend?.totals ?? [], config);
    const balance = Math.max(0, points - (redeemedByCustomer.get(c.id) ?? 0));
    byTier[tier] += 1;
    return {
      customerId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      spent,
      points,
      balance,
      tier,
      orderCount: spend?.orders ?? 0,
      lastOrderAt: spend?.lastOrderAt ? spend.lastOrderAt.toISOString() : null,
      isMember: !!member,
      joinedAt: member ? member.joinedAt.toISOString() : null,
      joinSource: member ? member.joinSource : null,
      marketingConsent: member?.marketingConsent || c.marketingConsent,
    };
  });

  rows.sort((a, b) => b.spent - a.spent || b.points - a.points);

  return {
    config,
    rows,
    stats: {
      totalPurchasers: spendByCustomer.size,
      totalMembers: members.length,
      byTier,
    },
  };
}
