import { prisma } from "@/lib/db/client";
import { sendWebPushToAll, type PushPayload } from "@/lib/push/web-push";
import { sendExpoPushToAll } from "@/lib/push/expo-push";

async function dispatchWebPush(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload,
): Promise<void> {
  if (subs.length === 0) return;
  const enriched: PushPayload = {
    icon: "/icon.png",
    badge: "/icon.png",
    requireInteraction: true,
    ...payload,
  };
  const result = await sendWebPushToAll(subs, enriched);
  if (result.expired.length > 0) {
    await prisma.merchantUserPushSubscription.deleteMany({
      where: { id: { in: result.expired } },
    });
  }
}

async function dispatchExpoPush(
  rows: { id: string; token: string }[],
  payload: PushPayload,
): Promise<void> {
  if (rows.length === 0) return;
  const result = await sendExpoPushToAll(rows, payload);
  if (result.expired.length > 0) {
    await prisma.merchantExpoPushToken.deleteMany({
      where: { id: { in: result.expired } },
    });
  }
}

export async function sendTenantPush(
  tenantId: string,
  payload: PushPayload,
): Promise<void> {
  const [webSubs, expoTokens] = await Promise.all([
    prisma.merchantUserPushSubscription.findMany({
      where: { OR: [{ tenantId }, { user: { tenantId } }] },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    }),
    prisma.merchantExpoPushToken.findMany({
      where: { OR: [{ tenantId }, { user: { tenantId } }] },
      select: { id: true, token: true },
    }),
  ]);

  await Promise.all([
    dispatchWebPush(webSubs, payload),
    dispatchExpoPush(expoTokens, payload),
  ]);
}

export async function sendMerchantUserPush(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const [webSubs, expoTokens] = await Promise.all([
    prisma.merchantUserPushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    }),
    prisma.merchantExpoPushToken.findMany({
      where: { userId },
      select: { id: true, token: true },
    }),
  ]);

  await Promise.all([
    dispatchWebPush(webSubs, payload),
    dispatchExpoPush(expoTokens, payload),
  ]);
}
