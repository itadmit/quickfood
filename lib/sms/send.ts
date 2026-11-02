/**
 * SMS sender - uses the central messaging API, decrements the tenant's local credit
 * balance, and writes an audit row to SmsLog.
 *
 * Hard gate: when `smsCreditsRemaining <= 0` the send is skipped and logged
 * with `status: skipped_no_balance`. The caller (e.g. a queued reminder job)
 * should treat that as a successful no-op, not an error.
 */
import { sendPoplySms } from "@/lib/poply/client";
import { normalizeSmsPhone } from "./phone";
import { smsFailureMessage } from "./messages";
import { prisma } from "@/lib/db/client";

const DEFAULT_SENDER = process.env.SMS_DEFAULT_SENDER ?? "QuickFood";

const CONSOLE_FALLBACK = process.env.SMS_PROVIDER === "console";

export interface SendSmsInput {
  tenantId: string;
  to: string;
  body: string;
  /** "review_reminder", "order_status", etc. */
  kind?: string;
  /** Optional reference for idempotency / observability (e.g. orderId). */
  refKind?: string;
  refId?: string;
  /**
   * Skip the per-tenant credit gate and decrement. Used for SMS test sends
   * from the dashboard - the platform absorbs the cost so merchants can
   * verify their sender is approved before they buy a package.
   */
  skipCredit?: boolean;
}

export interface SendSmsResult {
  status: "sent" | "skipped_no_balance" | "invalid_recipient" | "failed";
  logId: string;
  providerCode?: number;
  providerMsg?: string;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { smsCreditsRemaining: true, smsSender: true },
  });
  if (!tenant) {
    throw new Error(`tenant ${input.tenantId} not found`);
  }

  const sender = tenant.smsSender?.trim() || DEFAULT_SENDER;
  const to = normalizePhone(input.to);

  // Pre-create the log row in `pending` so we have an id to reference even
  // if the provider call throws.
  const log = await prisma.smsLog.create({
    data: {
      tenantId: input.tenantId,
      to,
      sender,
      body: input.body,
      kind: input.kind ?? "generic",
      refKind: input.refKind,
      refId: input.refId,
      status: "pending",
    },
    select: { id: true },
  });

  if (!isValidIsraeliMobile(to)) {
    await prisma.smsLog.update({
      where: { id: log.id },
      data: { status: "invalid_recipient", providerMsg: "bad phone format" },
    });
    return { status: "invalid_recipient", logId: log.id };
  }

  if (!input.skipCredit && tenant.smsCreditsRemaining <= 0) {
    await prisma.smsLog.update({
      where: { id: log.id },
      data: { status: "skipped_no_balance" },
    });
    return { status: "skipped_no_balance", logId: log.id };
  }

  // Dev fallback: log to console if SMS_PROVIDER=console.
  if (CONSOLE_FALLBACK) {
    console.log(`[sms:console] to=${to} sender=${sender} body=${input.body}`);
    const ops: Promise<unknown>[] = [
      prisma.smsLog.update({
        where: { id: log.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          providerCode: 1,
          providerMsg: "console fallback",
        },
      }),
    ];
    if (!input.skipCredit) {
      ops.push(
        prisma.tenant.update({
          where: { id: input.tenantId },
          data: { smsCreditsRemaining: { decrement: 1 } },
        }),
      );
    }
    await Promise.all(ops);
    return { status: "sent", logId: log.id };
  }

  let providerCode = 0;
  let providerMsg = "";
  try {
    const result = await sendPoplySms({ to, message: input.body, sender });
    if (!result.ok) console.warn("[sms] central messaging API rejected request", result.error);
    providerCode = result.ok ? 1 : 0;
    providerMsg = result.ok ? "ההודעה התקבלה לשליחה" : smsFailureMessage(result.error);
  } catch (err) {
    providerMsg = smsFailureMessage(err instanceof Error ? err.message : undefined);
  }

  // Positive status means accepted for delivery, not confirmed delivery.
  if (providerCode > 0) {
    const ops: Promise<unknown>[] = [
      prisma.smsLog.update({
        where: { id: log.id },
        data: { status: "sent", sentAt: new Date(), providerCode, providerMsg },
      }),
    ];
    if (!input.skipCredit) {
      ops.push(
        prisma.tenant.update({
          where: { id: input.tenantId },
          data: { smsCreditsRemaining: { decrement: 1 } },
        }),
      );
    }
    await Promise.all(ops);
    return { status: "sent", logId: log.id, providerCode, providerMsg };
  }

  await prisma.smsLog.update({
    where: { id: log.id },
    data: { status: "failed", providerCode, providerMsg },
  });
  return { status: "failed", logId: log.id, providerCode, providerMsg };
}

/** Normalize Israeli mobile numbers before validation. */
function normalizePhone(raw: string): string {
  return normalizeSmsPhone(raw);
}

function isValidIsraeliMobile(digits: string): boolean {
  // 10 digits, starts with 05
  return /^05\d{8}$/.test(digits);
}
