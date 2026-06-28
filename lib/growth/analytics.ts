import { prisma } from "@/lib/db/client";
import type { AttributionCategory, OrderStatus } from "@prisma/client";
import { resolveGrowthSettings, commissionRateFor } from "./settings";

export interface DateRange {
  from: Date;
  to: Date;
}

// A real, money-generating order. Mirrors the loyalty module's definition so
// "direct customer" counts line up across the dashboard.
const REAL_ORDER_STATUS_EXCLUDE: OrderStatus[] = ["pending", "cancelled", "refunded"];

interface OrderRow {
  customerId: string | null;
  total: number;
  createdAt: Date;
}

export interface CustomerAgg {
  firstOrderAt: Date;
  lastOrderAt: Date;
  orderCount: number;
  totalSpent: number;
}

export async function loadRealOrders(tenantId: string): Promise<OrderRow[]> {
  return prisma.order.findMany({
    where: { tenantId, status: { notIn: REAL_ORDER_STATUS_EXCLUDE }, customerId: { not: null } },
    select: { customerId: true, total: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export function aggregateByCustomer(orders: OrderRow[]): Map<string, CustomerAgg> {
  const map = new Map<string, CustomerAgg>();
  for (const o of orders) {
    if (!o.customerId) continue;
    const cur = map.get(o.customerId);
    if (!cur) {
      map.set(o.customerId, {
        firstOrderAt: o.createdAt,
        lastOrderAt: o.createdAt,
        orderCount: 1,
        totalSpent: o.total,
      });
    } else {
      cur.orderCount += 1;
      cur.totalSpent += o.total;
      if (o.createdAt < cur.firstOrderAt) cur.firstOrderAt = o.createdAt;
      if (o.createdAt > cur.lastOrderAt) cur.lastOrderAt = o.createdAt;
    }
  }
  return map;
}

function inRange(d: Date, range: DateRange): boolean {
  return d >= range.from && d <= range.to;
}

/** customerId -> { source, category, selfReported } first-touch map. */
async function loadAttributionMap(tenantId: string) {
  const rows = await prisma.customerAttribution.findMany({
    where: { tenantId, customerId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { customerId: true, source: true, sourceLabel: true, sourceCategory: true, selfReported: true },
  });
  const map = new Map<
    string,
    { source: string; sourceLabel: string; category: AttributionCategory; selfReported: boolean }
  >();
  for (const r of rows) {
    if (!r.customerId || map.has(r.customerId)) continue;
    map.set(r.customerId, {
      source: r.source,
      sourceLabel: r.sourceLabel,
      category: r.sourceCategory,
      selfReported: r.selfReported,
    });
  }
  return map;
}

export interface GrowthOverview {
  directCustomersAcquired: number;
  firstDirectOrders: number;
  repeatDirectOrders: number;
  directRevenue: number;
  estimatedCommissionSaved: number;
  commissionRate: number;
  qrScans: number;
  qrUniqueScans: number;
  qrSignups: number;
  scanToOrderRate: number; // 0..1
  repeatRate: number; // 0..1 of acquired customers who reordered
  bestSource: { label: string; revenue: number } | null;
  unattributedShare: number; // 0..1 of direct customers with no known source
}

/**
 * The headline numbers for the Growth overview. Commission saved is always an
 * ESTIMATE - it only counts revenue from customers whose first touch is a
 * marketplace source, times the assumed commission rate.
 */
export async function getDirectCustomerOverview(
  tenantId: string,
  range: DateRange,
): Promise<GrowthOverview> {
  const [tenant, orders, attribution, scanAgg] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { growthSettings: true } }),
    loadRealOrders(tenantId),
    loadAttributionMap(tenantId),
    prisma.qrScan.findMany({
      where: { tenantId, createdAt: { gte: range.from, lte: range.to } },
      select: { visitorId: true, customerId: true },
    }),
  ]);

  const settings = resolveGrowthSettings(tenant?.growthSettings);
  const byCustomer = aggregateByCustomer(orders);

  let directCustomersAcquired = 0;
  let firstDirectOrders = 0;
  let repeatDirectOrders = 0;
  let directRevenue = 0;
  let estimatedCommissionSaved = 0;
  let acquiredReordered = 0;
  let unattributed = 0;
  const revenueBySourceLabel = new Map<string, number>();

  for (const [customerId, agg] of byCustomer) {
    const acquiredNow = inRange(agg.firstOrderAt, range);
    if (acquiredNow) {
      directCustomersAcquired += 1;
      if (agg.orderCount > 1) acquiredReordered += 1;
      const attr = attribution.get(customerId);
      if (!attr) unattributed += 1;
    }
  }

  // Per-order pass for in-range revenue + first/repeat split + commission.
  for (const o of orders) {
    if (!o.customerId || !inRange(o.createdAt, range)) continue;
    directRevenue += o.total;
    const agg = byCustomer.get(o.customerId)!;
    const isFirst = o.createdAt.getTime() === agg.firstOrderAt.getTime();
    if (isFirst) firstDirectOrders += 1;
    else repeatDirectOrders += 1;

    const attr = attribution.get(o.customerId);
    if (attr) {
      revenueBySourceLabel.set(
        attr.sourceLabel,
        (revenueBySourceLabel.get(attr.sourceLabel) ?? 0) + o.total,
      );
      if (attr.category === "marketplace") {
        const rate = commissionRateFor(settings, attr.source);
        estimatedCommissionSaved += Math.round((o.total * rate) / 100);
      }
    }
  }

  let bestSource: { label: string; revenue: number } | null = null;
  for (const [label, revenue] of revenueBySourceLabel) {
    if (!bestSource || revenue > bestSource.revenue) bestSource = { label, revenue };
  }

  const uniqueVisitors = new Set(scanAgg.map((s) => s.visitorId).filter(Boolean));
  const qrSignups = new Set(scanAgg.map((s) => s.customerId).filter(Boolean)).size;
  const qrScans = scanAgg.length;

  return {
    directCustomersAcquired,
    firstDirectOrders,
    repeatDirectOrders,
    directRevenue,
    estimatedCommissionSaved,
    commissionRate: settings.commissionRate,
    qrScans,
    qrUniqueScans: uniqueVisitors.size,
    qrSignups,
    scanToOrderRate: qrScans > 0 ? firstDirectOrders / qrScans : 0,
    repeatRate: directCustomersAcquired > 0 ? acquiredReordered / directCustomersAcquired : 0,
    bestSource,
    unattributedShare:
      directCustomersAcquired > 0 ? unattributed / directCustomersAcquired : 0,
  };
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

/**
 * The Growth Timeline / acquisition funnel as store-wide period totals:
 * scans -> identified customers -> first orders -> repeat customers -> VIP.
 * Honest aggregates (not a strict single cohort) - labelled as period totals
 * in the UI.
 */
export async function getAcquisitionFunnel(
  tenantId: string,
  range: DateRange,
): Promise<FunnelStage[]> {
  const [scans, attribution, orders, vipCount] = await Promise.all([
    prisma.qrScan.count({ where: { tenantId, createdAt: { gte: range.from, lte: range.to } } }),
    prisma.customerAttribution.findMany({
      where: { tenantId, createdAt: { gte: range.from, lte: range.to }, customerId: { not: null } },
      select: { customerId: true },
      distinct: ["customerId"],
    }),
    loadRealOrders(tenantId),
    prisma.loyaltyMember.count({ where: { tenantId } }),
  ]);

  const byCustomer = aggregateByCustomer(orders);
  let firstOrders = 0;
  let repeatCustomers = 0;
  for (const [, agg] of byCustomer) {
    if (inRange(agg.firstOrderAt, range)) firstOrders += 1;
    if (agg.orderCount > 1) repeatCustomers += 1;
  }

  return [
    { key: "scans", label: "סריקות QR", count: scans },
    { key: "signups", label: "לקוחות שזוהו", count: attribution.length },
    { key: "first_orders", label: "הזמנה ישירה ראשונה", count: firstOrders },
    { key: "repeat", label: "לקוחות חוזרים", count: repeatCustomers },
    { key: "vip", label: "חברי מועדון", count: vipCount },
  ];
}

export interface SourceBreakdownRow {
  source: string;
  label: string;
  category: AttributionCategory | "unknown";
  customers: number;
  revenue: number;
  avgOrderValue: number;
  selfReported: boolean;
  estimatedCommissionSaved: number;
}

/** "מאיפה הלקוחות הגיעו" - per source, including an honest "לא ידוע" bucket. */
export async function getSourceBreakdown(
  tenantId: string,
  range: DateRange,
): Promise<SourceBreakdownRow[]> {
  const [tenant, orders, attribution] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { growthSettings: true } }),
    loadRealOrders(tenantId),
    loadAttributionMap(tenantId),
  ]);
  const settings = resolveGrowthSettings(tenant?.growthSettings);

  type Acc = {
    label: string;
    category: AttributionCategory | "unknown";
    source: string;
    customers: Set<string>;
    revenue: number;
    orders: number;
    selfReported: boolean;
    commission: number;
  };
  const acc = new Map<string, Acc>();
  const unknownKey = "__unknown__";

  for (const o of orders) {
    if (!o.customerId || !inRange(o.createdAt, range)) continue;
    const attr = attribution.get(o.customerId);
    const key = attr?.source ?? unknownKey;
    let row = acc.get(key);
    if (!row) {
      row = {
        label: attr?.sourceLabel ?? "לא ידוע",
        category: attr?.category ?? "unknown",
        source: attr?.source ?? "unknown",
        customers: new Set(),
        revenue: 0,
        orders: 0,
        selfReported: attr?.selfReported ?? false,
        commission: 0,
      };
      acc.set(key, row);
    }
    row.customers.add(o.customerId);
    row.revenue += o.total;
    row.orders += 1;
    if (attr?.category === "marketplace") {
      row.commission += Math.round((o.total * commissionRateFor(settings, attr.source)) / 100);
    }
  }

  return [...acc.values()]
    .map((r) => ({
      source: r.source,
      label: r.label,
      category: r.category,
      customers: r.customers.size,
      revenue: r.revenue,
      avgOrderValue: r.orders > 0 ? Math.round(r.revenue / r.orders) : 0,
      selfReported: r.selfReported,
      estimatedCommissionSaved: r.commission,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface QrPerformanceRow {
  campaignId: string;
  name: string;
  type: string;
  code: string;
  status: string;
  scans: number;
  uniqueScans: number;
  signups: number;
  firstOrders: number;
  repeatOrders: number;
  revenue: number;
  scanToSignupRate: number;
  signupToOrderRate: number;
  estimatedCommissionSaved: number;
}

/** Per-QR-campaign cohort performance (the real cohort - via campaignId). */
export async function getQrCampaignPerformance(
  tenantId: string,
  range: DateRange,
): Promise<QrPerformanceRow[]> {
  const [campaigns, scans, attributions, orders] = await Promise.all([
    prisma.qrCampaign.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" } }),
    prisma.qrScan.findMany({
      where: { tenantId, createdAt: { gte: range.from, lte: range.to } },
      select: { campaignId: true, visitorId: true },
    }),
    prisma.customerAttribution.findMany({
      where: { tenantId, campaignId: { not: null } },
      select: { campaignId: true, customerId: true },
    }),
    loadRealOrders(tenantId),
  ]);
  const byCustomer = aggregateByCustomer(orders);

  const scansByCampaign = new Map<string, { total: number; unique: Set<string> }>();
  for (const s of scans) {
    let e = scansByCampaign.get(s.campaignId);
    if (!e) {
      e = { total: 0, unique: new Set() };
      scansByCampaign.set(s.campaignId, e);
    }
    e.total += 1;
    if (s.visitorId) e.unique.add(s.visitorId);
  }

  const customersByCampaign = new Map<string, Set<string>>();
  for (const a of attributions) {
    if (!a.campaignId || !a.customerId) continue;
    let set = customersByCampaign.get(a.campaignId);
    if (!set) {
      set = new Set();
      customersByCampaign.set(a.campaignId, set);
    }
    set.add(a.customerId);
  }

  return campaigns.map((c) => {
    const sc = scansByCampaign.get(c.id) ?? { total: 0, unique: new Set<string>() };
    const cohort = customersByCampaign.get(c.id) ?? new Set<string>();
    let firstOrders = 0;
    let repeatOrders = 0;
    let revenue = 0;
    for (const cid of cohort) {
      const agg = byCustomer.get(cid);
      if (!agg) continue;
      firstOrders += 1;
      if (agg.orderCount > 1) repeatOrders += 1;
      revenue += agg.totalSpent;
    }
    const signups = cohort.size;
    return {
      campaignId: c.id,
      name: c.name,
      type: c.type,
      code: c.code,
      status: c.status,
      scans: sc.total,
      uniqueScans: sc.unique.size,
      signups,
      firstOrders,
      repeatOrders,
      revenue,
      scanToSignupRate: sc.total > 0 ? signups / sc.total : 0,
      signupToOrderRate: signups > 0 ? firstOrders / signups : 0,
      // Per-campaign commission attribution is computed at the store level
      // (getDirectCustomerOverview); kept 0 here to avoid double-counting.
      estimatedCommissionSaved: 0,
    };
  });
}

export interface CommissionSaved {
  estimatedSaved: number;
  marketplaceRevenue: number;
  commissionRate: number;
  isEstimate: true;
}

/** Standalone estimated-commission-saved figure (headline metric). */
export async function getEstimatedCommissionSaved(
  tenantId: string,
  range: DateRange,
): Promise<CommissionSaved> {
  const o = await getDirectCustomerOverview(tenantId, range);
  return {
    estimatedSaved: o.estimatedCommissionSaved,
    marketplaceRevenue:
      o.commissionRate > 0 ? Math.round((o.estimatedCommissionSaved * 100) / o.commissionRate) : 0,
    commissionRate: o.commissionRate,
    isEstimate: true,
  };
}
