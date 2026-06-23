/**
 * Thin client for Poply (our own email + SMS marketing platform - the
 * `poplynext` project). QuickFood holds one platform-level API key scoped
 * `quickfood_live_*`; per-merchant attribution rides in the message content,
 * not separate keys. Base URL + key come from env so staging/prod differ
 * without code changes.
 *
 * Poply API: POST /api/v1/send-email { to, subject, html, from }. Auth:
 * Authorization: Bearer <key>. (SMS is sent through QuickFood's own sms4free
 * integration instead - Poply fixes the SMS sender at the workspace level, so
 * it can't carry the merchant's business name; lib/sms/send.ts can.)
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

async function post(path: string, body: unknown): Promise<PoplySendResult> {
  if (!poplyConfigured()) return { ok: false, error: "poply_not_configured" };
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; id?: string; error?: string }
      | null;
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error ?? `poply_http_${res.status}` };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "poply_network_error" };
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
