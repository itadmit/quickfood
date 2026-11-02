/**
 * Platform-level SMS sender - uses the central messaging API, with NO tenant
 * context, credit gate, or SmsLog row. Use this for system messages that
 * fire before (or independent of) any tenant existing, e.g. the signup
 * phone-OTP. The platform absorbs the cost.
 *
 * For tenant-scoped sends (order updates, review reminders) use sendSms()
 * in ./send.ts instead - that one bills the merchant's credit balance.
 */
import { sendPoplySms } from "@/lib/poply/client";
import { normalizeSmsPhone } from "./phone";
import { smsFailureMessage } from "./messages";
import { hitDurable } from "@/lib/api/durable-rate-limit";

const DEFAULT_SENDER = process.env.SMS_DEFAULT_SENDER ?? "QuickFood";

const CONSOLE_FALLBACK = process.env.SMS_PROVIDER === "console";

// The platform signup-OTP endpoint was sprayed with random phone numbers
// (2026-08-05), draining thousands of SMS on the shared sms4free account.
// Platform SMS is now guarded by a DURABLE global + per-recipient rate limit
// (below), so it's safe to keep on. Set PLATFORM_SMS_ENABLED=false to hard-kill.
const PLATFORM_SMS_ENABLED = process.env.PLATFORM_SMS_ENABLED !== "false";
// Hard ceiling on platform SMS spend even under attack.
const GLOBAL_CAP = 25; // per 10 min, all platform SMS
const PER_RECIPIENT_CAP = 3; // per hour, same number

export interface SendRawSmsResult {
  status: "sent" | "invalid_recipient" | "failed";
  providerCode?: number;
  providerMsg?: string;
}

export async function sendRawSms(to: string, body: string): Promise<SendRawSmsResult> {
  if (!PLATFORM_SMS_ENABLED && !CONSOLE_FALLBACK) {
    return { status: "failed", providerMsg: "platform SMS disabled (abuse mitigation)" };
  }

  const recipient = normalizePhone(to);

  if (!isValidIsraeliMobile(recipient)) {
    return { status: "invalid_recipient", providerMsg: "bad phone format" };
  }

  if (!CONSOLE_FALLBACK) {
    if (!(await hitDurable("platform-sms:global", GLOBAL_CAP, 10 * 60_000))) {
      return { status: "failed", providerMsg: "platform SMS globally rate-limited" };
    }
    if (!(await hitDurable(`platform-sms:to:${recipient}`, PER_RECIPIENT_CAP, 60 * 60_000))) {
      return { status: "failed", providerMsg: "recipient rate-limited" };
    }
  }

  if (CONSOLE_FALLBACK) {
    console.log(`[sms:console] to=${recipient} sender=${DEFAULT_SENDER} body=${body}`);
    return { status: "sent", providerCode: 1, providerMsg: "console fallback" };
  }

  let providerCode = 0;
  let providerMsg = "";
  try {
    const result = await sendPoplySms({ to: recipient, message: body, sender: DEFAULT_SENDER });
    if (!result.ok) console.warn("[sms] central messaging API rejected request", result.error);
    providerCode = result.ok ? 1 : 0;
    providerMsg = result.ok ? "ההודעה התקבלה לשליחה" : smsFailureMessage(result.error);
  } catch (err) {
    providerMsg = smsFailureMessage(err instanceof Error ? err.message : undefined);
  }

  // API acceptance is not proof of delivery to the handset.
  console.log(
    `[sms-raw] to=${recipient} sender=${DEFAULT_SENDER} code=${providerCode} msg=${providerMsg || "-"}`,
  );
  if (providerCode > 0) {
    return { status: "sent", providerCode, providerMsg };
  }
  return { status: "failed", providerCode, providerMsg };
}

/** Normalize Israeli mobile numbers before validation. */
function normalizePhone(raw: string): string {
  return normalizeSmsPhone(raw);
}

function isValidIsraeliMobile(digits: string): boolean {
  return /^05\d{8}$/.test(digits);
}
