/** WhatsApp is disabled. Compatibility exports keep old jobs harmless. */
import { normalizeSmsPhone } from "@/lib/sms/phone";

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
   * sends from the dashboard - the platform absorbs the cost so merchants
   * can verify their iBot connection before they buy a package.
   */
  skipCredit?: boolean;
  /**
   * Force the platform iBot account, ignoring any tenant-owned credentials.
   * Used for the managed-WhatsApp reviews add-on
   * (`quickfood_reviews_whatsapp` subscription, ₪99/mo unlimited): sends go
   * out from QuickFood's WhatsApp number and never decrement the merchant's
   * SMS credit pool. Implies `skipCredit: true`.
   */
  useManagedAccount?: boolean;
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

export async function sendWhatsApp(_input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  void _input;
  return { status: "not_configured", logId: "", providerMsg: "ערוץ וואטסאפ אינו זמין כרגע" };
}
export interface SendRawWhatsAppResult {
  status: "sent" | "invalid_recipient" | "not_configured" | "rate_limited" | "failed";
  providerMsg?: string;
}
export async function sendRawWhatsApp(_to: string, _body: string): Promise<SendRawWhatsAppResult> {
  void _to; void _body;
  return { status: "not_configured", providerMsg: "ערוץ וואטסאפ אינו זמין כרגע" };
}
export function normalizePhone(raw: string): string { return normalizeSmsPhone(raw); }
export function isValidIsraeliMobile(digits: string): boolean { return /^05\d{8}$/.test(digits); }
export function toJid(phone: string): string { return `972${phone.replace(/^0/, "")}@s.whatsapp.net`; }
export async function callIBotSendText(_args: {
  token: string; instanceId: string; jid: string; msg: string;
}): Promise<{ ok: boolean; message: string }> {
  void _args;
  return { ok: false, message: "ערוץ וואטסאפ אינו זמין כרגע" };
}
