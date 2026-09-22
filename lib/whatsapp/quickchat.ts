/**
 * Quick Chat sender - the official WhatsApp route.
 *
 * Unlike the MacroDroid relay (our own Android device) and iBot, this goes
 * through Meta's Cloud API on QuickFood's verified business number, so it
 * cannot get the sender banned and replies land in the Quick Chat inbox
 * where the team already works.
 *
 * One call covers both sides of Meta's 24-hour rule. We hand Quick Chat the
 * full free-text message *and* an approved template; it picks:
 *   window open   -> the free text, in full, no charge
 *   window closed -> the template (what a fresh signup always hits), billed
 * A brand-new merchant has never messaged us, so in practice this sends the
 * template - the free-text path is what a returning merchant gets.
 *
 * Every failure is a soft one: the caller keeps MacroDroid/iBot as fallback,
 * and signup must never fail because a messaging provider hiccuped.
 */
import { normalizePhone, isValidIsraeliMobile } from "@/lib/whatsapp/send";

const BASE_URL = (process.env.QUICKCHAT_BASE_URL?.trim() || "https://quick-chat.app").replace(
  /\/+$/,
  "",
);
const API_KEY = process.env.QUICKCHAT_API_KEY?.trim();
/** Channel id is only required once the org has 2+ WhatsApp channels. */
const CHANNEL_ID = process.env.QUICKCHAT_CHANNEL_ID?.trim();
const TIMEOUT_MS = 10_000;

export interface QuickChatResult {
  ok: boolean;
  detail: string;
  /** Which route Quick Chat actually used - "text" is the free one. */
  mode?: "text" | "template";
  /** True when Meta billed for this send. */
  billable?: boolean;
  /** True when an idempotencyKey caught a repeat - nothing was sent. */
  duplicate?: boolean;
}

export function isQuickChatConfigured(): boolean {
  return !!API_KEY;
}

export async function sendViaQuickChat({
  phone,
  text,
  contactName,
  template,
  idempotencyKey,
}: {
  phone: string;
  /** Sent verbatim when the 24-hour window happens to be open. */
  text: string;
  contactName?: string;
  template: { name: string; language?: string; variables: string[] };
  /**
   * Stable per-event key. QStash and Vercel both retry, and without this a
   * retry sends the merchant a second copy - and bills us for it.
   */
  idempotencyKey: string;
}): Promise<QuickChatResult> {
  if (!API_KEY) return { ok: false, detail: "quickchat api key not configured" };

  const local = normalizePhone(phone);
  if (!isValidIsraeliMobile(local)) return { ok: false, detail: "bad phone format" };

  try {
    const res = await fetch(`${BASE_URL}/api/v1/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone: local,
        text,
        contactName,
        template: {
          name: template.name,
          language: template.language ?? "he",
          variables: template.variables,
        },
        idempotencyKey,
        ...(CHANNEL_ID ? { channelId: CHANNEL_ID } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      mode?: "text" | "template";
      billable?: boolean;
      duplicate?: boolean;
      error?: string;
      code?: string;
    } | null;

    if (!res.ok) {
      // `code` is the stable identifier; `error` is Hebrew prose meant for
      // a human. Log both - the code tells us whether this is worth paging
      // about (window_closed with no template = our bug) or just noise.
      return {
        ok: false,
        detail: `${res.status} ${json?.code ?? "unknown"}: ${json?.error ?? "no body"}`,
      };
    }

    return {
      ok: true,
      detail: `sent via ${json?.mode ?? "unknown"}`,
      mode: json?.mode,
      billable: json?.billable,
      duplicate: json?.duplicate,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: `request failed: ${detail}` };
  }
}
