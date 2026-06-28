import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";
import { loadRealOrders, aggregateByCustomer } from "./analytics";

const DAY_MS = 24 * 60 * 60 * 1000;

interface TaskSeed {
  key: string;
  title: string;
  description: string;
  expectedImpact: string;
  actionType: string;
  actionPayload?: Record<string, unknown>;
}

/**
 * The AI Growth Manager's to-do generator. Inspects real data, derives a set
 * of high-leverage next actions, and upserts them as GrowthTask rows. Keyed +
 * idempotent: a task the merchant already completed or dismissed is NOT
 * recreated, so the morning list never nags about finished work.
 */
export async function generateGrowthTasks(tenantId: string): Promise<void> {
  const now = new Date();
  const [qrCount, orders, customersWithBirthday] = await Promise.all([
    prisma.qrCampaign.count({ where: { tenantId } }),
    loadRealOrders(tenantId),
    // Birthdays among this tenant's customers (Customer is global - scope via orders).
    prisma.order.findMany({
      where: { tenantId, customerId: { not: null } },
      select: { customer: { select: { id: true, birthday: true } } },
      distinct: ["customerId"],
    }),
  ]);

  const byCustomer = aggregateByCustomer(orders);
  const acquired = byCustomer.size;
  let reordered = 0;
  let inactive30 = 0;
  for (const [, agg] of byCustomer) {
    if (agg.orderCount > 1) reordered += 1;
    if (now.getTime() - agg.lastOrderAt.getTime() > 30 * DAY_MS) inactive30 += 1;
  }
  const repeatRate = acquired > 0 ? reordered / acquired : 0;

  const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const birthdaysToday = customersWithBirthday.filter(
    (r) => r.customer?.birthday && r.customer.birthday.slice(5) === mmdd,
  ).length;

  const seeds: TaskSeed[] = [];

  if (qrCount === 0) {
    seeds.push({
      key: "create_first_qr",
      title: "צרו קמפיין QR ראשון",
      description: "קוד שתדביקו על שקיות המשלוח כדי שלקוחות יזמינו ישירות בפעם הבאה - בלי עמלות.",
      expectedImpact: "כל שקית הופכת להזדמנות ללקוח ישיר",
      actionType: "create_qr",
    });
  }

  if (inactive30 > 0) {
    seeds.push({
      key: "reactivate_inactive_30",
      title: `${inactive30} לקוחות לא הזמינו כבר 30 יום`,
      description: "שלחו קמפיין החזרה עם הטבה קטנה. לקוח קיים זול בהרבה מלקוח חדש.",
      expectedImpact: `פוטנציאל החזרה של ${inactive30} לקוחות`,
      actionType: "send_campaign",
      actionPayload: { segment: "inactive_30d", count: inactive30 },
    });
  }

  if (acquired >= 10 && repeatRate < 0.15) {
    seeds.push({
      key: "boost_repeat_rate",
      title: "רק חלק קטן מהלקוחות מזמינים פעם שנייה",
      description: "צרו קופון החזרה ל-7 ימים אחרי ההזמנה הראשונה - הדחיפה שמייצרת לקוח קבוע.",
      expectedImpact: "העלאת שיעור ההזמנה החוזרת",
      actionType: "create_coupon",
      actionPayload: { preset: "comeback_7d" },
    });
  }

  if (birthdaysToday > 0) {
    seeds.push({
      key: "birthdays_today",
      title: `${birthdaysToday} ימי הולדת היום`,
      description: "שלחו ברכה עם קופון יום הולדת - מחווה קטנה שמביאה הזמנה.",
      expectedImpact: `${birthdaysToday} הזדמנויות להזמנה היום`,
      actionType: "send_campaign",
      actionPayload: { segment: "birthday_today", count: birthdaysToday },
    });
  }

  for (const seed of seeds) {
    const existing = await prisma.growthTask.findUnique({
      where: { tenantId_key: { tenantId, key: seed.key } },
      select: { id: true, status: true },
    });
    const payload = seed.actionPayload
      ? (seed.actionPayload as Prisma.InputJsonValue)
      : undefined;
    if (!existing) {
      await prisma.growthTask.create({
        data: {
          tenantId,
          key: seed.key,
          title: seed.title,
          description: seed.description,
          expectedImpact: seed.expectedImpact,
          actionType: seed.actionType,
          actionPayload: payload,
        },
      });
    } else if (existing.status === "pending") {
      // Refresh the copy (counts change) without resurrecting dismissed/done.
      await prisma.growthTask.update({
        where: { id: existing.id },
        data: {
          title: seed.title,
          description: seed.description,
          expectedImpact: seed.expectedImpact,
          actionPayload: payload,
        },
      });
    }
  }
}

export async function listPendingTasks(tenantId: string) {
  return prisma.growthTask.findMany({
    where: { tenantId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
}

export async function setTaskStatus(
  tenantId: string,
  taskId: string,
  status: "completed" | "dismissed" | "pending",
) {
  const task = await prisma.growthTask.findFirst({
    where: { id: taskId, tenantId },
    select: { id: true },
  });
  if (!task) return null;
  return prisma.growthTask.update({
    where: { id: task.id },
    data: { status, completedAt: status === "completed" ? new Date() : null },
  });
}

/** Mark a checklist key done (manual items live as completed GrowthTask rows). */
export async function completeChecklistItem(
  tenantId: string,
  key: string,
  title: string,
) {
  return prisma.growthTask.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, title, status: "completed", completedAt: new Date(), actionType: "checklist" },
    update: { status: "completed", completedAt: new Date() },
  });
}
