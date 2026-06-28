import { prisma } from "@/lib/db/client";
import { loadRealOrders, aggregateByCustomer } from "./analytics";
import { resolveGrowthSettings, commissionRateFor } from "./settings";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ChurnRisk = "active" | "cooling" | "at_risk" | "lost";

export interface CustomerRow {
  customerId: string;
  name: string;
  phone: string;
  email: string | null;
  orderCount: number;
  totalSpent: number;
  firstOrderAt: string;
  lastOrderAt: string;
  daysSinceOrder: number;
  source: string | null;
  sourceLabel: string | null;
  firstCampaign: string | null;
  estCommissionSaved: number;
  isMember: boolean;
  risk: ChurnRisk;
}

export interface CustomerSegments {
  directCustomers: number;
  singleOrder: number;
  repeat: number;
  inactive30: number;
  inactive60: number;
  vip: number;
}

export interface SentCampaignRow {
  id: string;
  segment: string;
  channel: string;
  subject: string | null;
  recipients: number;
  sent: number;
  createdAt: string;
}

function riskOf(days: number): ChurnRisk {
  if (days >= 60) return "lost";
  if (days >= 30) return "at_risk";
  if (days >= 15) return "cooling";
  return "active";
}

/**
 * The customers view backing data: segment counts + ALL direct customers as
 * rows (the UI filters by segment), with per-customer attribution detail (first
 * source, first campaign, estimated commission saved) for the profile drawer.
 */
export async function getRepeatCustomers(
  tenantId: string,
  limit = 500,
): Promise<{ segments: CustomerSegments; rows: CustomerRow[] }> {
  const now = Date.now();
  const [orders, tenant] = await Promise.all([
    loadRealOrders(tenantId),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { growthSettings: true } }),
  ]);
  const settings = resolveGrowthSettings(tenant?.growthSettings);
  const byCustomer = aggregateByCustomer(orders);

  let singleOrder = 0;
  let repeat = 0;
  let inactive30 = 0;
  let inactive60 = 0;
  for (const [, agg] of byCustomer) {
    if (agg.orderCount === 1) singleOrder += 1;
    if (agg.orderCount > 1) repeat += 1;
    const days = (now - agg.lastOrderAt.getTime()) / DAY_MS;
    if (days >= 30) inactive30 += 1;
    if (days >= 60) inactive60 += 1;
  }

  const ids = [...byCustomer.keys()];

  const [customers, attributions, members] = await Promise.all([
    prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    }),
    prisma.customerAttribution.findMany({
      where: { tenantId, customerId: { in: ids } },
      orderBy: { createdAt: "asc" },
      select: {
        customerId: true,
        source: true,
        sourceLabel: true,
        sourceCategory: true,
        campaign: { select: { name: true } },
      },
    }),
    prisma.loyaltyMember.findMany({ where: { tenantId, customerId: { in: ids } }, select: { customerId: true } }),
  ]);

  const contact = new Map(customers.map((c) => [c.id, c]));
  const memberSet = new Set(members.map((m) => m.customerId));
  const attrMap = new Map<
    string,
    { source: string; sourceLabel: string; category: string; campaign: string | null }
  >();
  for (const a of attributions) {
    if (a.customerId && !attrMap.has(a.customerId)) {
      attrMap.set(a.customerId, {
        source: a.source,
        sourceLabel: a.sourceLabel,
        category: a.sourceCategory,
        campaign: a.campaign?.name ?? null,
      });
    }
  }

  const rows: CustomerRow[] = ids
    .map((id) => {
      const agg = byCustomer.get(id)!;
      const c = contact.get(id);
      const days = Math.floor((now - agg.lastOrderAt.getTime()) / DAY_MS);
      const attr = attrMap.get(id);
      const estCommissionSaved =
        attr?.category === "marketplace"
          ? Math.round((agg.totalSpent * commissionRateFor(settings, attr.source)) / 100)
          : 0;
      return {
        customerId: id,
        name: [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() || "לקוח/ה",
        phone: c?.phone ?? "",
        email: c?.email ?? null,
        orderCount: agg.orderCount,
        totalSpent: agg.totalSpent,
        firstOrderAt: agg.firstOrderAt.toISOString(),
        lastOrderAt: agg.lastOrderAt.toISOString(),
        daysSinceOrder: days,
        source: attr?.source ?? null,
        sourceLabel: attr?.sourceLabel ?? null,
        firstCampaign: attr?.campaign ?? null,
        estCommissionSaved,
        isMember: memberSet.has(id),
        risk: riskOf(days),
      };
    })
    .sort((a, b) => b.daysSinceOrder - a.daysSinceOrder)
    .slice(0, limit);

  return {
    segments: {
      directCustomers: byCustomer.size,
      singleOrder,
      repeat,
      inactive30,
      inactive60,
      vip: memberSet.size,
    },
    rows,
  };
}

/** Recent one-click Growth campaigns (history). */
export async function getRecentCampaigns(tenantId: string, limit = 20): Promise<SentCampaignRow[]> {
  const rows = await prisma.growthCampaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    segment: r.segment,
    channel: r.channel,
    subject: r.subject,
    recipients: r.recipients,
    sent: r.sent,
    createdAt: r.createdAt.toISOString(),
  }));
}
