/**
 * MacroDroid webhook sender - relays a WhatsApp message to an Android device
 * we own, which sends it from the real WhatsApp app instead of the metered
 * official API. Free per message; only as reliable as that phone being
 * online, so callers should keep a paid fallback.
 *
 * Contract (mirror this in the macro):
 *   POST <MACRODROID_WEBHOOK_URL>?phone=972XXXXXXXXX&name=...&business=...
 *   body: the message text (plain UTF-8, <= 3800 chars)
 * With MACRODROID_WEBHOOK_METHOD=get the message rides in a `message` query
 * param instead, for macros that cannot read the POST body.
 */
import { normalizePhone, isValidIsraeliMobile } from "@/lib/whatsapp/send";

const WEBHOOK_URL = process.env.MACRODROID_WEBHOOK_URL?.trim();
const METHOD = process.env.MACRODROID_WEBHOOK_METHOD?.trim().toLowerCase() === "get" ? "GET" : "POST";
const MAX_BODY = 3800;
const TIMEOUT_MS = 10_000;

export interface MacroDroidResult {
  ok: boolean;
  detail: string;
}

export function isMacroDroidConfigured(): boolean {
  return !!WEBHOOK_URL;
}

export async function sendViaMacroDroid({
  phone,
  message,
  vars = {},
}: {
  phone: string;
  message: string;
  vars?: Record<string, string | null | undefined>;
}): Promise<MacroDroidResult> {
  if (!WEBHOOK_URL) return { ok: false, detail: "macrodroid webhook not configured" };

  const local = normalizePhone(phone);
  if (!isValidIsraeliMobile(local)) return { ok: false, detail: "bad phone format" };

  const body = message.slice(0, MAX_BODY);
  const params = new URLSearchParams({ phone: `972${local.slice(1)}` });
  for (const [key, value] of Object.entries(vars)) {
    if (value) params.set(key, value);
  }
  if (METHOD === "GET") params.set("message", body);

  try {
    const res = await fetch(`${WEBHOOK_URL}?${params.toString()}`, {
      method: METHOD,
      ...(METHOD === "POST"
        ? { headers: { "Content-Type": "text/plain; charset=utf-8" }, body }
        : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, detail: `webhook ${res.status} ${text.slice(0, 120)}`.trim() };
    }
    return { ok: true, detail: "queued to device" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "fetch_failed" };
  }
}
