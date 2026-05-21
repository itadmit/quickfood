/**
 * SMS sender — wraps sms4free.co.il, decrements the tenant's local credit
 * balance, and writes an audit row to SmsLog.
 *
 * Hard gate: when `smsCreditsRemaining <= 0` the send is skipped and logged
 * with `status: skipped_no_balance`. The caller (e.g. a queued reminder job)
 * should treat that as a successful no-op, not an error.
 */
import { prisma } from "@/lib/db/client";

const SEND_URL = "https://api.sms4free.co.il/ApiSMS/v2/SendSMS";

const API_KEY = process.env.SMS4FREE_API_KEY ?? "";
const USER = process.env.SMS4FREE_USER ?? "";
const PASS = process.env.SMS4FREE_PASS ?? "";
const DEFAULT_SENDER = process.env.SMS4FREE_DEFAULT_SENDER ?? "QuickFood";

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
   * from the dashboard — the platform absorbs the cost so merchants can
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
    // eslint-disable-next-line no-console
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

  if (!API_KEY || !USER || !PASS) {
    await prisma.smsLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        providerMsg: "sms4free not configured (missing SMS4FREE_USER/PASS/API_KEY)",
      },
    });
    return {
      status: "failed",
      logId: log.id,
      providerMsg: "sms4free not configured",
    };
  }

  let providerCode = 0;
  let providerMsg = "";
  try {
    const res = await fetch(SEND_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: API_KEY,
        user: USER,
        pass: PASS,
        sender,
        recipient: to,
        msg: input.body,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: number;
      message?: string;
    };
    providerCode = data.status ?? 0;
    providerMsg = data.message ?? "";
  } catch (err) {
    providerMsg = err instanceof Error ? err.message : "fetch_failed";
  }

  // sms4free: status > 0 ⇒ delivered to N recipients. Anything ≤ 0 is a failure.
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

/** "05X-XXXXXXX" → "05XXXXXXXX". sms4free wants digits-only. */
function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function isValidIsraeliMobile(digits: string): boolean {
  // 10 digits, starts with 05
  return /^05\d{8}$/.test(digits);
}
