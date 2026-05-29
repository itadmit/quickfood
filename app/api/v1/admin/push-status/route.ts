import { handler, apiJson } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireAdmin();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? null;
  const subject = process.env.VAPID_SUBJECT ?? null;
  const [courierSubs, merchantSubs] = await Promise.all([
    prisma.courierPushSubscription.count(),
    prisma.merchantUserPushSubscription.count(),
  ]);
  return apiJson({
    vapid: {
      public_key_set: !!publicKey,
      public_key_preview: publicKey ? `${publicKey.slice(0, 8)}…${publicKey.slice(-6)}` : null,
      private_key_set: !!privateKey,
      subject_set: !!subject,
    },
    subscriptions: {
      couriers: courierSubs,
      merchants: merchantSubs,
    },
  });
});
