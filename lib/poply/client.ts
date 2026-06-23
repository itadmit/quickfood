/**
 * Thin client for Poply (our own email + SMS marketing platform - the
 * `poplynext` project). QuickFood holds one platform-level API key scoped
 * `quickfood_live_*`; per-merchant attribution rides in the message content,
 * not separate keys. Base URL + key come from env so staging/prod differ
 * without code changes.
 *
 * Poply API: POST /api/v1/send-email { to, subject, html }, POST
 * /api/v1/send-sms { to, message }. Auth: Authorization: Bearer <key>.
 */

const BASE = process.env.POPLY_API_URL?.replace(/\/$/, "") ?? "";
const KEY = process.env.POPLY_API_KEY ?? "";

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
}): Promise<PoplySendResult> {
  return post("/api/v1/send-email", input);
}

export function sendPoplySms(input: { to: string; message: string }): Promise<PoplySendResult> {
  return post("/api/v1/send-sms", { to: input.to, message: input.message });
}
