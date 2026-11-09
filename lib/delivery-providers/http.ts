import type { ProviderSendResult } from "@/lib/delivery-providers/types";

const TIMEOUT_MS = 8000;

export async function providerPost(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<ProviderSendResult & { json: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = (await res.text().catch(() => "")).slice(0, 1000);
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, response: text, error: res.ok ? null : `http_${res.status}`, json };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      response: "",
      error: err instanceof Error ? err.message : "fetch_failed",
      json: null,
    };
  } finally {
    clearTimeout(timer);
  }
}
