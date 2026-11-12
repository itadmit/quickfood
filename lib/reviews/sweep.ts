import { prisma } from "@/lib/db/client";
import { sendReviewReminderNow, type SendReviewResult } from "@/lib/reviews/send-now";

const GRACE_MS = 15 * 60_000;
const WINDOW_MS = 6 * 60 * 60_000;
const MAX_DELAY_MS = 1440 * 60_000;
const BATCH = 25;

export interface SweepResult {
  checked: number;
  due: number;
  sent: number;
  skipped: Record<string, number>;
}

export async function sweepMissedReviewReminders(
  now: Date = new Date(),
  send: (orderId: string) => Promise<SendReviewResult> = (id) =>
    sendReviewReminderNow(id, { allowResend: false }),
): Promise<SweepResult> {
  const result: SweepResult = { checked: 0, due: 0, sent: 0, skipped: {} };

  const tenants = await prisma.tenant.findMany({
    where: { reviewsEnabled: true, reviewsChannel: { not: "off" } },
    select: { id: true, reviewsDelayMinutes: true },
  });
  if (tenants.length === 0) return result;
  const delayByTenant = new Map(tenants.map((t) => [t.id, Math.max(1, t.reviewsDelayMinutes) * 60_000]));

  const orders = await prisma.order.findMany({
    where: {
      tenantId: { in: tenants.map((t) => t.id) },
      status: "delivered",
      createdAt: { gte: new Date(now.getTime() - MAX_DELAY_MS - WINDOW_MS - 24 * 60 * 60_000) },
      deliveredAt: { not: null },
      customerId: { not: null },
      reviewPromptDismissedAt: null,
      review: { is: null },
    },
    select: { id: true, tenantId: true, deliveredAt: true },
  });
  result.checked = orders.length;

  const candidates = orders.filter((o) => {
    const delay = delayByTenant.get(o.tenantId);
    if (delay === undefined || !o.deliveredAt) return false;
    const dueAt = o.deliveredAt.getTime() + delay;
    return now.getTime() >= dueAt + GRACE_MS && now.getTime() <= dueAt + WINDOW_MS;
  });
  if (candidates.length === 0) return result;

  const ids = candidates.map((o) => o.id);
  const where = { kind: "review_reminder", refKind: "order", refId: { in: ids } };
  const [smsLogs, emailLogs] = await Promise.all([
    prisma.smsLog.findMany({ where, select: { refId: true } }),
    prisma.emailLog.findMany({ where, select: { refId: true } }),
  ]);
  const attempted = new Set([...smsLogs, ...emailLogs].map((l) => l.refId));

  const due = candidates.filter((o) => !attempted.has(o.id)).slice(0, BATCH);
  result.due = due.length;

  for (const o of due) {
    try {
      const r = await send(o.id);
      if (r.ok) result.sent++;
      else result.skipped[r.reason] = (result.skipped[r.reason] ?? 0) + 1;
    } catch (err) {
      console.error("[reviews] sweep send failed", o.id, err);
      result.skipped.error = (result.skipped.error ?? 0) + 1;
    }
  }
  return result;
}
