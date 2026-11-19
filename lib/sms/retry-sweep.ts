import { prisma } from "@/lib/db/client";
import { sendSms } from "./send";

const RETRYABLE_KINDS = [
  "order_confirmed",
  "order_ready",
  "order_on_the_way",
  "order_delivered",
  "courier_assigned",
  "review_reminder",
];
const FINAL_STATUSES = new Set(["sent", "delivered", "skipped_no_balance", "invalid_recipient"]);
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 30 * 60_000;
const SETTLE_MS = 2 * 60_000;

export async function loadRecentRetryableSms(now: Date) {
  return prisma.smsLog.findMany({
    where: {
      kind: { in: RETRYABLE_KINDS },
      channel: "sms",
      refId: { not: null },
      createdAt: { gte: new Date(now.getTime() - WINDOW_MS) },
    },
    orderBy: { createdAt: "asc" },
    select: {
      tenantId: true,
      to: true,
      body: true,
      kind: true,
      refKind: true,
      refId: true,
      status: true,
      createdAt: true,
    },
  });
}

type SmsRow = Awaited<ReturnType<typeof loadRecentRetryableSms>>[number];

export function pickRetries(rows: SmsRow[], now: Date): SmsRow[] {
  const groups = new Map<string, SmsRow[]>();
  for (const row of rows) {
    const key = `${row.tenantId}|${row.to}|${row.kind}|${row.refId}`;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const picks: SmsRow[] = [];
  for (const attempts of groups.values()) {
    if (attempts.some((a) => FINAL_STATUSES.has(a.status))) continue;
    if (attempts.length >= MAX_ATTEMPTS) continue;
    const last = attempts[attempts.length - 1];
    if (now.getTime() - last.createdAt.getTime() < SETTLE_MS) continue;
    picks.push(last);
  }
  return picks;
}

export async function sweepFailedSms(now = new Date()): Promise<{ retried: number; sent: number }> {
  const picks = pickRetries(await loadRecentRetryableSms(now), now);
  let retried = 0;
  let sent = 0;
  for (const last of picks) {
    retried++;
    const result = await sendSms({
      tenantId: last.tenantId,
      to: last.to,
      body: last.body,
      kind: last.kind,
      refKind: last.refKind ?? undefined,
      refId: last.refId ?? undefined,
    }).catch((err) => {
      console.error("[sms-retry] resend threw", err);
      return null;
    });
    if (result?.status === "sent") sent++;
  }

  if (retried > 0) console.log(`[sms-retry] retried=${retried} sent=${sent}`);
  return { retried, sent };
}
