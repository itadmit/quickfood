import crypto from "node:crypto";
import { FB_PIXEL_ID, FB_GRAPH_VERSION } from "./config";

const TOKEN = process.env.FB_CAPI_ACCESS_TOKEN;
const TEST_CODE = process.env.FB_CAPI_TEST_EVENT_CODE;

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export interface CapiEvent {
  eventName: string;
  eventId?: string;
  eventSourceUrl?: string;
  actionSource?: string;
  params?: Record<string, unknown>;
  email?: string;
  phones?: Array<string | undefined | null>;
  externalId?: string;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string;
  clientUserAgent?: string;
}

export async function sendCapiEvent(event: CapiEvent): Promise<{ ok: boolean; skipped?: string; fb?: unknown }> {
  if (!TOKEN || !FB_PIXEL_ID) {
    return { ok: false, skipped: "not_configured" };
  }

  const user_data: Record<string, unknown> = {};
  if (event.email) user_data.em = [sha256(event.email.trim().toLowerCase())];
  const phoneHashes = (event.phones ?? [])
    .map((p) => (p ? normalizePhone(p) : ""))
    .filter(Boolean)
    .map((p) => sha256(p));
  if (phoneHashes.length) user_data.ph = phoneHashes;
  if (event.externalId) user_data.external_id = [sha256(event.externalId)];
  if (event.clientIp) user_data.client_ip_address = event.clientIp;
  if (event.clientUserAgent) user_data.client_user_agent = event.clientUserAgent;
  if (event.fbp) user_data.fbp = event.fbp;
  if (event.fbc) user_data.fbc = event.fbc;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        event_source_url: event.eventSourceUrl,
        action_source: event.actionSource ?? "website",
        user_data,
        custom_data: event.params ?? {},
      },
    ],
  };
  if (TEST_CODE) payload.test_event_code = TEST_CODE;

  const res = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/${FB_PIXEL_ID}/events?access_token=${TOKEN}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const fb = (await res.json().catch(() => ({}))) as unknown;
  return { ok: res.ok, fb };
}

export function readFbCookies(cookieHeader: string | null | undefined): {
  fbp?: string;
  fbc?: string;
} {
  const cookie = cookieHeader ?? "";
  return {
    fbp: /(?:^|;\s*)_fbp=([^;]+)/.exec(cookie)?.[1],
    fbc: /(?:^|;\s*)_fbc=([^;]+)/.exec(cookie)?.[1],
  };
}
