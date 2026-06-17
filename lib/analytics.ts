import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";
import { HIDE_UNPAID_NONCASH } from "@/lib/orders-visible";

export type Range = "today" | "yesterday" | "7d" | "30d" | "custom";

export function rangeBounds(range: Range, custom?: { from?: Date; to?: Date }) {
  const now = new Date();
  const today = israelStartOfDay(now);
  switch (range) {
    case "today": {
      return { from: today, to: now, previousFrom: dayBack(today, 1), previousTo: today };
    }
    case "yesterday": {
      const y = dayBack(today, 1);
      return { from: y, to: today, previousFrom: dayBack(y, 1), previousTo: y };
    }
    case "7d": {
      const f = dayBack(today, 6);
      return {
        from: f,
        to: now,
        previousFrom: dayBack(f, 7),
        previousTo: f,
      };
    }
    case "30d": {
      const f = dayBack(today, 29);
      return {
        from: f,
        to: now,
        previousFrom: dayBack(f, 30),
        previousTo: f,
      };
    }
    case "custom": {
      const f = custom?.from ?? dayBack(today, 6);
      const t = custom?.to ?? now;
      const span = t.getTime() - f.getTime();
      return {
        from: f,
        to: t,
        previousFrom: new Date(f.getTime() - span),
        previousTo: f,
      };
    }
  }
}

const ANALYTICS_TZ = "Asia/Jerusalem";

/** Israel's UTC offset (ms, positive = ahead of UTC) at the given instant. */
function israelOffsetMs(at: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: ANALYTICS_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(at)
    .reduce((a, x) => {
      a[x.type] = x.value;
      return a;
    }, {} as Record<string, string>);
  const hour = p.hour === "24" ? 0 : Number(p.hour);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second);
  return asUtc - at.getTime();
}

/** UTC instant of the Israel-local midnight for the day containing `at`. */
function israelStartOfDay(at: Date): Date {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(at)
    .reduce((a, x) => {
      a[x.type] = x.value;
      return a;
    }, {} as Record<string, string>);
  const utcMidnight = Date.UTC(+p.year, +p.month - 1, +p.day, 0, 0, 0);
  return new Date(utcMidnight - israelOffsetMs(new Date(utcMidnight)));
}

/** N Israel-days before `d` (an Israel midnight), DST-safe via midday snap. */
function dayBack(d: Date, n: number) {
  return israelStartOfDay(new Date(d.getTime() - n * 86_400_000 + 12 * 3_600_000));
}

// Orders that count toward the dashboard: any real order placed, EXCEPT
// cancelled/refunded and card orders abandoned at the payment screen. This
// deliberately includes in-progress orders (new / confirmed / preparing /
// ready / out-for-delivery / delivered) so the dashboard reflects live
// activity during service, not only orders that already went out the door.
const COUNTED: Prisma.OrderWhereInput = {
  status: { notIn: ["cancelled", "refunded"] },
  NOT: HIDE_UNPAID_NONCASH,
};

export async function summary(tenantId: string, range: Range) {
  const { from, to, previousFrom, previousTo } = rangeBounds(range);

  const [current, previous] = await Promise.all([
    aggregateBucket(tenantId, from, to),
    aggregateBucket(tenantId, previousFrom, previousTo),
  ]);

  return {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    orders: { count: current.count, delta: pctDelta(current.count, previous.count) },
    revenue: { value: current.revenue, delta: pctDelta(current.revenue, previous.revenue) },
    avg_order: { value: current.avgOrder, delta: pctDelta(current.avgOrder, previous.avgOrder) },
    avg_prep: { value: current.avgPrepMinutes, delta: pctDelta(current.avgPrepMinutes, previous.avgPrepMinutes) },
  };
}

async function aggregateBucket(tenantId: string, from: Date, to: Date) {
  const where: Prisma.OrderWhereInput = {
    tenantId,
    createdAt: { gte: from, lt: to },
    ...COUNTED,
  };
  const rows = await prisma.order.findMany({
    where,
    select: { total: true, createdAt: true, confirmedAt: true, readyAt: true },
  });
  const count = rows.length;
  const revenue = rows.reduce((acc, r) => acc + r.total, 0);
  const avgOrder = count > 0 ? Math.round(revenue / count) : 0;
  const prepMins = rows
    .filter((r) => r.readyAt && r.confirmedAt)
    .map((r) => (r.readyAt!.getTime() - r.confirmedAt!.getTime()) / 60_000);
  const avgPrepMinutes = prepMins.length > 0 ? Math.round(prepMins.reduce((a, b) => a + b, 0) / prepMins.length) : 0;
  return { count, revenue, avgOrder, avgPrepMinutes };
}

function pctDelta(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function hourly(tenantId: string, range: Range) {
  const { from, to, previousFrom, previousTo } = rangeBounds(range);
  const [cur, prev] = await Promise.all([
    bucketByHour(tenantId, from, to),
    bucketByHour(tenantId, previousFrom, previousTo),
  ]);
  return { current: cur, previous: prev };
}

const ISRAEL_HOUR_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  hour12: false,
});

function israelHour(d: Date): number {
  return parseInt(ISRAEL_HOUR_FMT.format(d), 10) % 24;
}

async function bucketByHour(tenantId: string, from: Date, to: Date): Promise<number[]> {
  const rows = await prisma.order.findMany({
    where: {
      tenantId,
      createdAt: { gte: from, lt: to },
      ...COUNTED,
    },
    select: { createdAt: true },
  });
  const buckets = new Array(24).fill(0);
  for (const r of rows) {
    buckets[israelHour(r.createdAt)]++;
  }
  return buckets;
}

export async function topItems(tenantId: string, range: Range, limit = 5) {
  const { from, to } = rangeBounds(range);

  const rows = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: {
      order: {
        tenantId,
        createdAt: { gte: from, lt: to },
        ...COUNTED,
      },
      menuItemId: { not: null },
    },
    _sum: { quantity: true, totalPrice: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  const ids = rows.map((r) => r.menuItemId!).filter(Boolean);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, artType: true },
  });
  const itemsById = new Map(items.map((i) => [i.id, i]));

  return rows.map((r) => {
    const item = r.menuItemId ? itemsById.get(r.menuItemId) : null;
    return {
      item_id: r.menuItemId,
      name: item?.name ?? "פריט שנמחק",
      art_type: item?.artType ?? null,
      count: r._sum.quantity ?? 0,
      revenue: r._sum.totalPrice ?? 0,
    };
  });
}

/* ─── Channel breakdown (AI / upsell / direct) ───────────────────── */

export interface ChannelBucket {
  source: "direct" | "ai_advisor" | "reorder";
  orders: number;
  revenue: number;
  avgOrder: number;
}

export interface UpsellStat {
  lineCount: number;
  revenue: number;
  /** Distinct orders that contained at least one upsell line. */
  ordersTouched: number;
}

export async function channelBreakdown(tenantId: string, range: Range) {
  const { from, to } = rangeBounds(range);
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      createdAt: { gte: from, lt: to },
      ...COUNTED,
    },
    select: { source: true, total: true },
  });

  const buckets = new Map<string, { orders: number; revenue: number }>();
  for (const o of orders) {
    const key = o.source;
    const b = buckets.get(key) ?? { orders: 0, revenue: 0 };
    b.orders += 1;
    b.revenue += o.total;
    buckets.set(key, b);
  }

  const out: ChannelBucket[] = (
    ["direct", "ai_advisor", "reorder"] as const
  ).map((s) => {
    const b = buckets.get(s) ?? { orders: 0, revenue: 0 };
    return {
      source: s,
      orders: b.orders,
      revenue: b.revenue,
      avgOrder: b.orders > 0 ? Math.round(b.revenue / b.orders) : 0,
    };
  });

  // Upsell stats live at the line level - they're a per-item phenomenon
  // and don't show up in Order.source. Group the upsell lines separately.
  const upsellLines = await prisma.orderItem.findMany({
    where: {
      source: "upsell",
      order: {
        tenantId,
        createdAt: { gte: from, lt: to },
        ...COUNTED,
      },
    },
    select: { totalPrice: true, orderId: true },
  });
  const upsellOrderIds = new Set(upsellLines.map((l) => l.orderId));
  const upsell: UpsellStat = {
    lineCount: upsellLines.length,
    revenue: upsellLines.reduce((a, l) => a + l.totalPrice, 0),
    ordersTouched: upsellOrderIds.size,
  };

  return { channels: out, upsell };
}

/* ─── Customer segments (new vs returning) ───────────────────────── */

export async function customerSegments(tenantId: string, range: Range) {
  const { from, to } = rangeBounds(range);
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      createdAt: { gte: from, lt: to },
      ...COUNTED,
    },
    select: { customerId: true, customerPhoneSnap: true, total: true, createdAt: true },
  });

  // Group by customer identity (logged-in id beats guest phone snap).
  type Key = string;
  const identityKey = (o: { customerId: string | null; customerPhoneSnap: string | null }): Key =>
    o.customerId ?? (o.customerPhoneSnap ? `phone:${o.customerPhoneSnap}` : `anon:${Math.random()}`);

  const byCustomer = new Map<Key, { orders: number; revenue: number }>();
  for (const o of orders) {
    const k = identityKey(o);
    const b = byCustomer.get(k) ?? { orders: 0, revenue: 0 };
    b.orders += 1;
    b.revenue += o.total;
    byCustomer.set(k, b);
  }

  // Returning = had a prior order before `from`.
  const customerIds = Array.from(
    new Set(orders.filter((o) => o.customerId).map((o) => o.customerId!)),
  );
  const phones = Array.from(
    new Set(
      orders
        .filter((o) => !o.customerId && o.customerPhoneSnap)
        .map((o) => o.customerPhoneSnap!),
    ),
  );
  const [priorById, priorByPhone] = await Promise.all([
    customerIds.length > 0
      ? prisma.order.findMany({
          where: {
            tenantId,
            customerId: { in: customerIds },
            createdAt: { lt: from },
            ...COUNTED,
          },
          select: { customerId: true },
          distinct: ["customerId"],
        })
      : Promise.resolve([] as { customerId: string | null }[]),
    phones.length > 0
      ? prisma.order.findMany({
          where: {
            tenantId,
            customerPhoneSnap: { in: phones },
            createdAt: { lt: from },
            ...COUNTED,
          },
          select: { customerPhoneSnap: true },
          distinct: ["customerPhoneSnap"],
        })
      : Promise.resolve([] as { customerPhoneSnap: string | null }[]),
  ]);
  const returningCustomerIds = new Set(priorById.map((r) => r.customerId).filter(Boolean));
  const returningPhones = new Set(priorByPhone.map((r) => r.customerPhoneSnap).filter(Boolean));

  let newC = 0, returningC = 0, newRev = 0, returningRev = 0, newOrders = 0, returningOrders = 0;
  for (const o of orders) {
    const isReturning = o.customerId
      ? returningCustomerIds.has(o.customerId)
      : o.customerPhoneSnap
        ? returningPhones.has(o.customerPhoneSnap)
        : false;
    if (isReturning) {
      returningOrders += 1;
      returningRev += o.total;
    } else {
      newOrders += 1;
      newRev += o.total;
    }
  }
  for (const [k] of byCustomer) {
    if (k.startsWith("phone:")) {
      if (returningPhones.has(k.slice(6))) returningC += 1;
      else newC += 1;
    } else if (k.startsWith("anon:")) {
      newC += 1; // can't link guest with no phone - count as new
    } else {
      if (returningCustomerIds.has(k)) returningC += 1;
      else newC += 1;
    }
  }

  return {
    new: { customers: newC, orders: newOrders, revenue: newRev },
    returning: { customers: returningC, orders: returningOrders, revenue: returningRev },
    total: { customers: newC + returningC, orders: orders.length },
  };
}

/* ─── Operational health (accept rate / prep time / cancel rate) ──── */

export async function operationalHealth(tenantId: string, range: Range) {
  const { from, to } = rangeBounds(range);
  const orders = await prisma.order.findMany({
    where: {
      tenantId,
      createdAt: { gte: from, lt: to },
    },
    select: {
      status: true,
      createdAt: true,
      confirmedAt: true,
      readyAt: true,
      deliveredAt: true,
      cancelledAt: true,
    },
  });

  const total = orders.length;
  const cancelled = orders.filter((o) => o.status === "cancelled" || o.cancelledAt).length;
  const accepted = orders.filter((o) => o.confirmedAt).length;

  const prepDurations = orders
    .filter((o) => o.readyAt && o.confirmedAt)
    .map((o) => (o.readyAt!.getTime() - o.confirmedAt!.getTime()) / 60_000);
  const avgPrepMinutes =
    prepDurations.length > 0
      ? Math.round(prepDurations.reduce((a, b) => a + b, 0) / prepDurations.length)
      : 0;

  const acceptDurations = orders
    .filter((o) => o.confirmedAt)
    .map((o) => (o.confirmedAt!.getTime() - o.createdAt.getTime()) / 60_000);
  const avgAcceptMinutes =
    acceptDurations.length > 0
      ? Math.round(acceptDurations.reduce((a, b) => a + b, 0) / acceptDurations.length)
      : 0;

  return {
    total,
    acceptRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
    cancelRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    avgPrepMinutes,
    avgAcceptMinutes,
  };
}

/* ─── Insights (narrative cards, heuristics on local data only) ───── */

export interface Insight {
  /** "strength" = positive win to celebrate. "watch" = something to act on. */
  tone: "strength" | "watch";
  title: string;
  /** Detail line beneath the title; ≤ ~80 chars Hebrew. */
  body: string;
  /** Optional concrete number that anchors the insight ("+18%", "32%"). */
  metric?: string;
}

export async function insights(tenantId: string, range: Range): Promise<Insight[]> {
  const { from, to } = rangeBounds(range);
  const [orders, channelData] = await Promise.all([
    prisma.order.findMany({
      where: {
        tenantId,
        createdAt: { gte: from, lt: to },
        ...COUNTED,
      },
      select: {
        total: true,
        createdAt: true,
        source: true,
        customerId: true,
        customerPhoneSnap: true,
      },
    }),
    channelBreakdown(tenantId, range),
  ]);

  const out: Insight[] = [];

  // 1. Peak hour
  if (orders.length >= 5) {
    const buckets = new Array(24).fill(0);
    for (const o of orders) buckets[israelHour(o.createdAt)]++;
    const peakHour = buckets.indexOf(Math.max(...buckets));
    const peakShare = Math.round((buckets[peakHour] / orders.length) * 100);
    if (peakShare >= 15) {
      out.push({
        tone: "strength",
        title: `השעה הכי חמה: ${pad(peakHour)}:00`,
        body: `מרכזת ${peakShare}% מההזמנות בטווח. כדאי להבטיח כוח אדם בשעה זו.`,
        metric: `${peakShare}%`,
      });
    }
  }

  // 2. AI advisor uplift
  const aiBucket = channelData.channels.find((c) => c.source === "ai_advisor");
  const directBucket = channelData.channels.find((c) => c.source === "direct");
  if (aiBucket && aiBucket.orders >= 3 && directBucket && directBucket.orders >= 3) {
    const uplift = Math.round(((aiBucket.avgOrder - directBucket.avgOrder) / directBucket.avgOrder) * 100);
    if (uplift > 0) {
      out.push({
        tone: "strength",
        title: "היועץ AI מעלה את הסל",
        body: `הזמנות שהתחילו עם היועץ ה-AI מציגות AOV גבוה ב-${uplift}% מהזמנות רגילות.`,
        metric: `+${uplift}%`,
      });
    } else if (uplift < -10) {
      out.push({
        tone: "watch",
        title: "AOV נמוך יותר ב-AI",
        body: `הזמנות AI מציגות AOV נמוך ב-${Math.abs(uplift)}% - כדאי לבדוק את ההצעות.`,
        metric: `${uplift}%`,
      });
    }
  }

  // 3. Upsell contribution
  if (channelData.upsell.ordersTouched > 0) {
    const upsellShare = Math.round((channelData.upsell.ordersTouched / orders.length) * 100);
    out.push({
      tone: "strength",
      title: "Upsell בעגלה עובד",
      body: `${upsellShare}% מההזמנות כוללות פריט שנוסף מקרוסלת ה-Upsell, סה"כ ${formatShekels(channelData.upsell.revenue)}.`,
      metric: `${upsellShare}%`,
    });
  }

  // 4. Returning customers share
  const segs = await customerSegments(tenantId, range);
  if (segs.total.orders >= 5 && segs.returning.orders > 0) {
    const returningShare = Math.round((segs.returning.orders / segs.total.orders) * 100);
    if (returningShare >= 30) {
      out.push({
        tone: "strength",
        title: "לקוחות חוזרים",
        body: `${returningShare}% מההזמנות בטווח הזה הגיעו מלקוחות שכבר הזמינו אצלך בעבר.`,
        metric: `${returningShare}%`,
      });
    } else if (returningShare < 15 && segs.total.orders >= 20) {
      out.push({
        tone: "watch",
        title: "אחוז חזרה נמוך",
        body: `רק ${returningShare}% מההזמנות הן מלקוחות חוזרים. בדוק קמפיין רימרקטינג.`,
        metric: `${returningShare}%`,
      });
    }
  }

  // 5. Operational excellence
  const ops = await operationalHealth(tenantId, range);
  if (ops.total >= 5 && ops.cancelRate <= 5 && ops.acceptRate >= 90) {
    out.push({
      tone: "strength",
      title: "ביצוע תפעולי מצוין",
      body: `${ops.acceptRate}% הזמנות מאושרות, ${ops.cancelRate}% ביטולים בלבד.`,
      metric: `${ops.acceptRate}%`,
    });
  } else if (ops.cancelRate >= 15 && ops.total >= 10) {
    out.push({
      tone: "watch",
      title: "אחוז ביטולים גבוה",
      body: `${ops.cancelRate}% ביטולים בטווח הזה - בדוק זמינות פריטים וזמני שיא.`,
      metric: `${ops.cancelRate}%`,
    });
  }

  return out.slice(0, 6);
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function formatShekels(agorot: number): string {
  // Money fields ARE shekels in this project per the schema (not agorot).
  // Verified in lib/orders-create.ts where deliveryFee/total are stored
  // as plain shekel integers. Keep the variable named `agorot` only as
  // a defensive reminder if the project ever switches.
  return `${agorot}₪`;
}
