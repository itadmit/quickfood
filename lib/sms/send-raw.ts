/**
 * Platform-level SMS sender - calls sms4free.co.il directly with NO tenant
 * context, credit gate, or SmsLog row. Use this for system messages that
 * fire before (or independent of) any tenant existing, e.g. the signup
 * phone-OTP. The platform absorbs the cost.
 *
 * For tenant-scoped sends (order updates, review reminders) use sendSms()
 * in ./send.ts instead - that one bills the merchant's credit balance.
 */
const SEND_URL = "https://api.sms4free.co.il/ApiSMS/v2/SendSMS";

const API_KEY = process.env.SMS4FREE_API_KEY ?? "";
const USER = process.env.SMS4FREE_USER ?? "";
const PASS = process.env.SMS4FREE_PASS ?? "";
const DEFAULT_SENDER = process.env.SMS4FREE_DEFAULT_SENDER ?? "QuickFood";

const CONSOLE_FALLBACK = process.env.SMS_PROVIDER === "console";

export interface SendRawSmsResult {
  status: "sent" | "invalid_recipient" | "failed";
  providerCode?: number;
  providerMsg?: string;
}

export async function sendRawSms(to: string, body: string): Promise<SendRawSmsResult> {
  const recipient = normalizePhone(to);

  if (!isValidIsraeliMobile(recipient)) {
    return { status: "invalid_recipient", providerMsg: "bad phone format" };
  }

  if (CONSOLE_FALLBACK) {
    console.log(`[sms:console] to=${recipient} sender=${DEFAULT_SENDER} body=${body}`);
    return { status: "sent", providerCode: 1, providerMsg: "console fallback" };
  }

  if (!API_KEY || !USER || !PASS) {
    return {
      status: "failed",
      providerMsg: "sms4free not configured (missing SMS4FREE_USER/PASS/API_KEY)",
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
        sender: DEFAULT_SENDER,
        recipient,
        msg: body,
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

  // sms4free: status > 0 ⇒ ACCEPTED for delivery (returns the recipient
  // count). Note this is "accepted", not "delivered" - an unverified
  // alphanumeric sender can be accepted here yet dropped by the carrier, so
  // we log the provider's exact code/message to diagnose silent non-delivery.
  console.log(
    `[sms-raw] to=${recipient} sender=${DEFAULT_SENDER} code=${providerCode} msg=${providerMsg || "-"}`,
  );
  if (providerCode > 0) {
    return { status: "sent", providerCode, providerMsg };
  }
  return { status: "failed", providerCode, providerMsg };
}

/** "05X-XXXXXXX" → "05XXXXXXXX". sms4free wants digits-only. */
function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function isValidIsraeliMobile(digits: string): boolean {
  return /^05\d{8}$/.test(digits);
}
