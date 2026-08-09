/**
 * Thin HTTP client for DelivApp's Data Integration API
 * (https://delivapp.com/developers/api). All calls are JSON POSTs to
 * `${BASE_URL}/<path>` authenticated with the two Parse headers.
 *
 * Set DELIVAPP_PROVIDER=console to short-circuit every call (local dev / tests)
 * so no real request leaves the machine.
 */

const BASE_URL =
  process.env.DELIVAPP_BASE_URL ?? "https://api.delivapp.com/data/api";
const CONSOLE_FALLBACK = process.env.DELIVAPP_PROVIDER === "console";
const TIMEOUT_MS = 8000;

export interface DelivAppCall {
  path: string;
  appId: string;
  apiKey: string;
  body: Record<string, unknown>;
}

export interface DelivAppResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  error?: string;
}

export async function delivAppPost({
  path,
  appId,
  apiKey,
  body,
}: DelivAppCall): Promise<DelivAppResult> {
  if (CONSOLE_FALLBACK) {
    console.log(`[delivapp:console] POST ${path}`, JSON.stringify(body));
    return { ok: true, status: 200, data: { BarcodeId: "console-fallback" } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Parse-Application-Id": appId,
        "X-Parse-REST-API-Key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? undefined : `http_${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: {},
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
