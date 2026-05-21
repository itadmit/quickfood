/**
 * WhatsApp sender — wraps iBot Chat (https://ibot-chat.com/api/v1),
 * shares the per-tenant credit pool with SMS, and writes an audit row to
 * the unified `sms_logs` table with `channel: "whatsapp"`.
 *
 * Each tenant brings their own iBot account (token + instance_id) so the
 * message goes out from THEIR connected WhatsApp business number. The
 * platform absorbs no provider cost beyond what the merchant already paid
 * for in their messaging-credits package.
 *
 * Hard gate: when `smsCreditsRemaining <= 0` the send is skipped and logged
 * with `status: skipped_no_balance`. The caller (e.g. a queued reminder job)
 * should treat that as a successful no-op, not an error.
 */
import { prisma } from "@/lib/db/client";

const BASE_URL = process.env.IBOT_BASE_URL ?? "https://ibot-chat.com/api/v1";
const SEND_TEXT_PATH = "/send-text";

const CONSOLE_FALLBACK = process.env.WHATSAPP_PROVIDER === "console";

export interface SendWhatsAppInput {
  tenantId: string;
  to: string;
  body: string;
  /** "review_reminder", "order_status", etc. */
  kind?: string;
  /** Optional reference for idempotency / observability (e.g. orderId). */
  refKind?: string;
  refId?: string;
  /**
   * Skip the per-tenant credit gate and decrement. Used for WhatsApp test
   * sends from the dashboard — the platform absorbs the cost so merchants
   * can verify their iBot connection before they buy a package.
   */
  skipCredit?: boolean;
}

export interface SendWhatsAppResult {
  status:
    | "sent"
    | "skipped_no_balance"
    | "invalid_recipient"
    | "not_configured"
    | "failed";
  logId: string;
  providerMsg?: string;
}

export async function sendWhatsApp(
  input: SendWhatsAppInput,
): Promise<SendWhatsAppResult> {
  // Tenant credentials win when set; otherwise fall back to the platform
  // singleton (`platform_settings`) which the super-admin maintains from
  // /admin/settings/whatsapp. This lets us onboard small merchants without
  // forcing them to open their own iBot account.
  const [tenant, platform] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: {
        smsCreditsRemaining: true,
        whatsappToken: true,
        whatsappInstanceId: true,
      },
    }),
    prisma.platformSettings.findUnique({
      where: { id: "singleton" },
      select: {
        whatsappDefaultToken: true,
        whatsappDefaultInstanceId: true,
      },
    }),
  ]);
  if (!tenant) {
    throw new Error(`tenant ${input.tenantId} not found`);
  }

  const token = tenant.whatsappToken ?? platform?.whatsappDefaultToken ?? null;
  const instanceId =
    tenant.whatsappInstanceId ?? platform?.whatsappDefaultInstanceId ?? null;
  const usingPlatformDefault =
    !tenant.whatsappToken && !tenant.whatsappInstanceId && !!token && !!instanceId;

  const to = normalizePhone(input.to);
  const jid = toJid(to);

  const log = await prisma.smsLog.create({
    data: {
      tenantId: input.tenantId,
      to,
      sender: instanceId ?? "whatsapp",
      body: input.body,
      channel: "whatsapp",
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

  if (!token || !instanceId) {
    await prisma.smsLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        providerMsg:
          "whatsapp not configured (no tenant creds and no platform default)",
      },
    });
    return {
      status: "not_configured",
      logId: log.id,
      providerMsg: "whatsapp not configured",
    };
  }

  if (!input.skipCredit && tenant.smsCreditsRemaining <= 0) {
    await prisma.smsLog.update({
      where: { id: log.id },
      data: { status: "skipped_no_balance" },
    });
    return { status: "skipped_no_balance", logId: log.id };
  }

  if (CONSOLE_FALLBACK) {
    // eslint-disable-next-line no-console
    console.log(`[whatsapp:console] jid=${jid} body=${input.body}`);
    const ops: Promise<unknown>[] = [
      prisma.smsLog.update({
        where: { id: log.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          providerMsg: usingPlatformDefault
            ? "console fallback (platform default)"
            : "console fallback",
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

  // iBot Chat is a GET-only API (querystring auth). Encode the message + jid
  // carefully — `msg` may contain Hebrew, newlines, or URL fragments.
  const params = new URLSearchParams({
    token,
    instance_id: instanceId,
    jid,
    msg: input.body,
  });
  const url = `${BASE_URL}${SEND_TEXT_PATH}?${params.toString()}`;

  let providerOk = false;
  let providerMsg = "";
  try {
    const res = await fetch(url, { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
    };
    providerOk = !!data.success;
    providerMsg = data.message ?? "";
  } catch (err) {
    providerMsg = err instanceof Error ? err.message : "fetch_failed";
  }

  if (providerOk) {
    const finalMsg = usingPlatformDefault
      ? `${providerMsg ? providerMsg + " · " : ""}via platform default`
      : providerMsg;
    const ops: Promise<unknown>[] = [
      prisma.smsLog.update({
        where: { id: log.id },
        data: { status: "sent", sentAt: new Date(), providerMsg: finalMsg },
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
    return { status: "sent", logId: log.id, providerMsg };
  }

  await prisma.smsLog.update({
    where: { id: log.id },
    data: { status: "failed", providerMsg },
  });
  return { status: "failed", logId: log.id, providerMsg };
}

/** "05X-XXXXXXX" → "05XXXXXXXX". */
function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function isValidIsraeliMobile(digits: string): boolean {
  return /^05\d{8}$/.test(digits);
}

/** "0501234567" → "972501234567@s.whatsapp.net". iBot expects the WhatsApp
 * JID format: country code without `+`, no leading zero, then the suffix. */
function toJid(israeliMobile: string): string {
  const local = israeliMobile.replace(/^0/, "");
  return `972${local}@s.whatsapp.net`;
}
