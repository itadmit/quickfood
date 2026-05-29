import { prisma } from "@/lib/db/client";
import { sendWebPushToAll, type PushPayload } from "@/lib/push/web-push";

export async function sendTenantPush(
  tenantId: string,
  payload: PushPayload,
): Promise<void> {
  const subs = await prisma.merchantUserPushSubscription.findMany({
    where: {
      OR: [
        { tenantId },
        { user: { tenantId } },
      ],
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
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

export async function sendMerchantUserPush(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const subs = await prisma.merchantUserPushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
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
