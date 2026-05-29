import { prisma } from "@/lib/db/client";
import { sendWebPushToAll, type PushPayload } from "@/lib/push/web-push";

export async function sendCourierPush(
  courierId: string,
  payload: PushPayload,
): Promise<void> {
  const subs = await prisma.courierPushSubscription.findMany({
    where: { courierId },
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
    await prisma.courierPushSubscription.deleteMany({
      where: { id: { in: result.expired } },
    });
  }
}
