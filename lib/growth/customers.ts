import { prisma } from "@/lib/db/client";
import { loadRealOrders, aggregateByCustomer } from "./analytics";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RepeatCustomerRow {
  customerId: string;
  name: string;
  phone: string;
  email: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
  daysSinceOrder: number;
  source: string | null;
  sourceLabel: string | null;
  // "active" | "cooling" (15-30d) | "at_risk" (30-60d) | "lost" (60d+)
  risk: "active" | "cooling" | "at_risk" | "lost";
}

export interface CustomerSegments {
  directCustomers: number;
  singleOrder: number;
  repeat: number;
  inactive30: number;
  inactive60: number;
  vip: number;
}

function riskOf(days: number): RepeatCustomerRow["risk"] {
  if (days >= 60) return "lost";
  if (days >= 30) return "at_risk";
  if (days >= 15) return "cooling";
  return "active";
}

/**
 * Repeat-customer view: segment counts + the list of customers who ordered
 * directly 2+ times, sorted by churn risk (oldest last-order first) so the
 * merchant sees who to win back at the top. Contact info comes from the
 * global Customer row; first-touch source from CustomerAttribution.
 */
export async function getRepeatCustomers(
  tenantId: string,
  limit = 100,
): Promise<{ segments: CustomerSegments; rows: RepeatCustomerRow[] }> {
  const now = Date.now();
  const orders = await loadRealOrders(tenantId);
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

  const repeatIds = [...byCustomer.entries()]
    .filter(([, a]) => a.orderCount > 1)
    .map(([id]) => id);

  const [customers, attributions, vip] = await Promise.all([
    prisma.customer.findMany({
      where: { id: { in: repeatIds } },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    }),
    prisma.customerAttribution.findMany({
      where: { tenantId, customerId: { in: repeatIds } },
      orderBy: { createdAt: "asc" },
      select: { customerId: true, source: true, sourceLabel: true },
    }),
    prisma.loyaltyMember.count({ where: { tenantId } }),
  ]);

  const contact = new Map(customers.map((c) => [c.id, c]));
  const attrMap = new Map<string, { source: string; sourceLabel: string }>();
  for (const a of attributions) {
    if (a.customerId && !attrMap.has(a.customerId)) {
      attrMap.set(a.customerId, { source: a.source, sourceLabel: a.sourceLabel });
    }
  }

  const rows: RepeatCustomerRow[] = repeatIds
    .map((id) => {
      const agg = byCustomer.get(id)!;
      const c = contact.get(id);
      const days = Math.floor((now - agg.lastOrderAt.getTime()) / DAY_MS);
      const attr = attrMap.get(id);
      const name = [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() || "לקוח/ה";
      return {
        customerId: id,
        name,
        phone: c?.phone ?? "",
        email: c?.email ?? null,
        orderCount: agg.orderCount,
        totalSpent: agg.totalSpent,
        lastOrderAt: agg.lastOrderAt.toISOString(),
        daysSinceOrder: days,
        source: attr?.source ?? null,
        sourceLabel: attr?.sourceLabel ?? null,
        risk: riskOf(days),
      };
    })
    // Win-back first: most days since last order at the top.
    .sort((a, b) => b.daysSinceOrder - a.daysSinceOrder)
    .slice(0, limit);

  return {
    segments: {
      directCustomers: byCustomer.size,
      singleOrder,
      repeat,
      inactive30,
      inactive60,
      vip,
    },
    rows,
  };
}
