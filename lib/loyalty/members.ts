import { prisma } from "@/lib/db/client";
import {
  resolveLoyaltyConfig,
  pointsForSpend,
  tierForPoints,
  type LoyaltyConfig,
  type LoyaltyTier,
} from "@/lib/loyalty/config";

export interface LoyaltyMemberRow {
  customerId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  spent: number;
  points: number;
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

  const [grouped, members] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerId"],
      where: {
        tenantId,
        customerId: { not: null },
        status: { notIn: ["cancelled", "refunded"] },
      },
      _sum: { total: true },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.loyaltyMember.findMany({
      where: { tenantId },
      orderBy: { joinedAt: "desc" },
    }),
  ]);

  const spendByCustomer = new Map<
    string,
    { spent: number; orders: number; lastOrderAt: Date | null }
  >();
  for (const g of grouped) {
    if (!g.customerId) continue;
    spendByCustomer.set(g.customerId, {
      spent: g._sum.total ?? 0,
      orders: g._count._all,
      lastOrderAt: g._max.createdAt ?? null,
    });
  }

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
    const points = pointsForSpend(spent, config);
    const tier = tierForPoints(points, config);
    byTier[tier] += 1;
    return {
      customerId: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      spent,
      points,
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
