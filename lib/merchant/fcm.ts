// Sends a native FCM DATA message to a tenant's registered Android devices when
// a new order arrives. DATA (not notification) so the QuickFood app builds the
// notification itself on the merchant's chosen sound channel (see the app's
// QuickFoodMessagingService).
//
// Setup:
//   npm i firebase-admin
//   env: FIREBASE_ADMIN_CREDENTIALS = <Service Account JSON, single line>

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { prisma } from "@/lib/db/client";

function fcmApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0]!;
  const creds = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS || "{}");
  return initializeApp({ credential: cert(creds) });
}

export interface FcmOrderPayload {
  orderId: string;
  title: string; // e.g. "הזמנה חדשה - VR-1234"
  body: string; // e.g. '89 ש"ח · משלוח'
  deeplink?: string; // default "/dashboard/orders"
}

export async function sendTenantFcm(tenantId: string, payload: FcmOrderPayload): Promise<void> {
  if (!process.env.FIREBASE_ADMIN_CREDENTIALS) return; // push not configured yet

  const devices = await prisma.nativeDeviceToken.findMany({
    where: { tenantId },
    select: { fcmToken: true },
  });
  if (devices.length === 0) return;

  const messaging = getMessaging(fcmApp());

  const res = await messaging.sendEachForMulticast({
    tokens: devices.map((d) => d.fcmToken),
    // DATA-only: no `notification` key, so the app always handles it (even backgrounded).
    data: {
      orderId: payload.orderId,
      title: payload.title,
      body: payload.body,
      deeplink: payload.deeplink ?? "/dashboard/orders",
    },
    android: { priority: "high" }, // wake the app to post the alert even when idle
  });

  // Drop tokens the push service rejected (uninstalled / expired).
  const stale: string[] = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code ?? "";
    if (
      !r.success &&
      (code.includes("registration-token-not-registered") || code.includes("invalid-argument"))
    ) {
      stale.push(devices[i].fcmToken);
    }
  });
  if (stale.length) {
    await prisma.nativeDeviceToken.deleteMany({ where: { fcmToken: { in: stale } } });
  }
}
