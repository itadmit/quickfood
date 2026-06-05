/**
 * Web Push - shared low-level send.
 *
 * Uses the `web-push` library to encrypt and POST to the user agent's push
 * service (FCM, Mozilla autopush, APNs). All three are free of charge.
 *
 * Subscriptions that the push service marks gone (HTTP 404 or 410) are
 * deleted from the DB so we don't keep retrying them. Callers must pass
 * `onExpired` so we know which table to clean up - the model differs
 * between couriers and merchants.
 */
import webpush from "web-push";

let configured = false;

function configure() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:owner@quickfood.co.il";
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Path the SW should open on click - relative or absolute. */
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  /** When true, the notification stays until the user dismisses it. */
  requireInteraction?: boolean;
  /** Forces Android/desktop default sound. iOS plays one by default. */
  silent?: boolean;
  data?: Record<string, unknown>;
}

export interface SendResult {
  sent: number;
  expired: string[];
  failed: number;
}

export async function sendWebPushToAll(
  subs: PushSubscriptionRow[],
  payload: PushPayload,
): Promise<SendResult> {
  if (subs.length === 0) return { sent: 0, expired: [], failed: 0 };
  configure();
  const json = JSON.stringify(payload);
  const expired: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          json,
          { TTL: 3600 },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          expired.push(s.id);
        } else {
          failed += 1;
          console.warn("[push] send failed", status, (err as Error).message);
        }
      }
    }),
  );

  return { sent, expired, failed };
}
