/**
 * Expo Push - shared low-level send for the native merchant app.
 *
 * The native app registers a single `ExponentPushToken[...]` string (no
 * VAPID keys). Delivery goes through Expo's push service at exp.host, which
 * fans out to APNs (iOS) and FCM (Android) for us, free of charge.
 *
 * Tokens that Expo reports as `DeviceNotRegistered` are returned in
 * `expired` so the caller can delete them from `merchant_expo_push_tokens`
 * and stop retrying - mirrors `sendWebPushToAll` in ./web-push.ts.
 */
import type { PushPayload, SendResult } from "./web-push";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
// Expo accepts up to 100 messages per request.
const CHUNK_SIZE = 100;

export interface ExpoTokenRow {
  id: string;
  token: string;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: "default" | null;
  priority: "high";
  channelId: string;
  badge?: number;
  data?: Record<string, unknown>;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function toMessage(token: string, payload: PushPayload): ExpoMessage {
  return {
    to: token,
    title: payload.title,
    body: payload.body,
    sound: payload.silent ? null : "default",
    priority: "high",
    channelId: "orders",
    data: {
      ...(payload.data ?? {}),
      ...(payload.url ? { url: payload.url } : {}),
    },
  };
}

export async function sendExpoPushToAll(
  rows: ExpoTokenRow[],
  payload: PushPayload,
): Promise<SendResult> {
  if (rows.length === 0) return { sent: 0, expired: [], failed: 0 };

  // Map token -> row id so we can flag DeviceNotRegistered tickets back to
  // the DB row that needs deleting. Tickets come back in request order.
  const expired: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const group of chunk(rows, CHUNK_SIZE)) {
    const messages = group.map((r) => toMessage(r.token, payload));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        failed += group.length;
        console.warn("[expo-push] send failed", res.status, await res.text());
        continue;
      }
      const json = (await res.json()) as { data?: ExpoTicket[] };
      const tickets = json.data ?? [];
      tickets.forEach((ticket, i) => {
        if (ticket.status === "ok") {
          sent += 1;
        } else if (ticket.details?.error === "DeviceNotRegistered") {
          expired.push(group[i].id);
        } else {
          failed += 1;
          console.warn("[expo-push] ticket error", ticket.message);
        }
      });
    } catch (err) {
      failed += group.length;
      console.warn("[expo-push] request error", (err as Error).message);
    }
  }

  return { sent, expired, failed };
}
