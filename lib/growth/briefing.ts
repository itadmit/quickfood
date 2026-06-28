import { prisma } from "@/lib/db/client";
import { loadRealOrders, aggregateByCustomer } from "./analytics";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BriefingFinding {
  text: string;
  actionType?: string;
  actionLabel?: string;
  actionPayload?: Record<string, unknown>;
}

export interface DailyBriefing {
  greeting: string;
  findings: BriefingFinding[];
  estimatedOpportunity: number; // integer shekels
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "בוקר טוב";
  if (h < 18) return "צהריים טובים";
  return "ערב טוב";
}

/**
 * The morning AI briefing - the 30-second "what should I do today" read. Built
 * from real signals (inactive customers, birthdays, repeat gaps) and surfaces
 * a single estimated-opportunity number plus one-click actions.
 */
export async function getDailyBriefing(tenantId: string): Promise<DailyBriefing> {
  const now = new Date();
  const [orders, birthdayRows] = await Promise.all([
    loadRealOrders(tenantId),
    prisma.order.findMany({
      where: { tenantId, customerId: { not: null } },
      select: { customer: { select: { birthday: true } } },
      distinct: ["customerId"],
    }),
  ]);

  const byCustomer = aggregateByCustomer(orders);
  let inactive30 = 0;
  let inactiveSpend = 0;
  let avgOrder = 0;
  let totalOrders = 0;
  let totalSpent = 0;
  for (const [, agg] of byCustomer) {
    totalOrders += agg.orderCount;
    totalSpent += agg.totalSpent;
    if (now.getTime() - agg.lastOrderAt.getTime() > 30 * DAY_MS) {
      inactive30 += 1;
      inactiveSpend += Math.round(agg.totalSpent / agg.orderCount);
    }
  }
  avgOrder = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;

  const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const birthdaysToday = birthdayRows.filter(
    (r) => r.customer?.birthday && r.customer.birthday.slice(5) === mmdd,
  ).length;

  const findings: BriefingFinding[] = [];
  let opportunity = 0;

  if (inactive30 > 0) {
    findings.push({
      text: `${inactive30} לקוחות לא הזמינו כבר 30 יום.`,
      actionType: "send_campaign",
      actionLabel: "שלחו קמפיין החזרה",
      actionPayload: { segment: "inactive_30d", count: inactive30 },
    });
    // Opportunity = estimated recovered value if a fraction return at avg order.
    opportunity += Math.round(inactive30 * 0.15 * Math.max(avgOrder, inactiveSpend));
  }

  if (birthdaysToday > 0) {
    findings.push({
      text: `${birthdaysToday} ימי הולדת היום.`,
      actionType: "send_campaign",
      actionLabel: "שלחו קופון יום הולדת",
      actionPayload: { segment: "birthday_today", count: birthdaysToday },
    });
    opportunity += Math.round(birthdaysToday * 0.4 * avgOrder);
  }

  if (findings.length === 0) {
    findings.push({
      text: "אין משימות דחופות הבוקר. כדאי לבדוק את ה-Boost Score ולסמן עוד צעד אחד.",
      actionType: "create_qr",
      actionLabel: "צרו קמפיין QR",
    });
  }

  return {
    greeting: greetingFor(now),
    findings,
    estimatedOpportunity: opportunity,
  };
}
