/**
 * Thin client for Poply (our own email + SMS marketing platform - the
 * `poplynext` project). QuickFood holds one platform-level API key scoped
 * `quickfood_live_*`; per-merchant attribution rides in the message content,
 * not separate keys. Base URL + key come from env so staging/prod differ
 * without code changes.
 *
 * Poply API: POST /api/v1/send-email { to, subject, html, from } and POST
 * /api/v1/send-sms { to, message, sender }. Auth: Authorization: Bearer <key>.
 * Both email and SMS for the loyalty club run through Poply; the per-message
 * `sender`/`from` carry the merchant's business name.
 *
 * POPLY_FROM_EMAIL is QuickFood's verified sender address inside Poply. When
 * set, broadcasts send as `<BusinessName> <POPLY_FROM_EMAIL>` so the display
 * name is the merchant's, over QuickFood's verified domain.
 */

const BASE = process.env.POPLY_API_URL?.replace(/\/$/, "") ?? "";
const KEY = process.env.POPLY_API_KEY ?? "";
const FROM_EMAIL = process.env.POPLY_FROM_EMAIL ?? "";

/** Build a Poply `from` string ("Name <email>") for a given business name. */
export function poplyFrom(businessName: string): string | undefined {
  if (!FROM_EMAIL) return undefined;
  const name = businessName.trim();
  return name ? `${name} <${FROM_EMAIL}>` : FROM_EMAIL;
}

export function poplyConfigured(): boolean {
  return BASE.length > 0 && KEY.length > 0;
}

export interface PoplySendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

const RETRY_DELAYS_MS = [500, 1500];
const REQUEST_TIMEOUT_MS = 10_000;
const RETRYABLE_HTTP = new Set([503, 504]);

async function post(path: string, body: unknown): Promise<PoplySendResult> {
  if (!poplyConfigured()) return { ok: false, error: "poply_not_configured" };
  let result = await postOnce(path, body);
  for (const delay of RETRY_DELAYS_MS) {
    if (result.ok || !result.retryable) break;
    console.warn(`[poply] ${path} transient failure, retrying`, result.error);
    await new Promise((r) => setTimeout(r, delay));
    result = await postOnce(path, body);
  }
  return { ok: result.ok, id: result.id, error: result.error };
}

async function postOnce(
  path: string,
  body: unknown,
): Promise<PoplySendResult & { retryable?: boolean }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; id?: string; error?: string }
      | null;
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error ?? `poply_http_${res.status}`,
        retryable: RETRYABLE_HTTP.has(res.status),
      };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      error: timedOut ? "poply_timeout" : err instanceof Error ? err.message : "poply_network_error",
      retryable: !timedOut,
    };
  }
}

export function sendPoplyEmail(input: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<PoplySendResult> {
  return post("/api/v1/send-email", input);
}

export function sendPoplySms(input: {
  to: string;
  message: string;
  /** Per-message sender id (merchant business name). Omit → workspace default. */
  sender?: string;
}): Promise<PoplySendResult> {
  return post("/api/v1/send-sms", input);
}
