import { z } from "zod";
import { headers } from "next/headers";
import { handler, apiJson } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SubscribeBody = z.object({
  endpoint: z.string().url().min(20),
  keys: z.object({
    p256dh: z.string().min(40),
    auth: z.string().min(10),
  }),
});

const UnsubscribeBody = z.object({
  endpoint: z.string().url(),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant();
  const body = SubscribeBody.parse(await req.json());
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent")?.slice(0, 200) ?? null;

  await prisma.merchantUserPushSubscription.upsert({
    where: { endpoint: body.endpoint },
    update: {
      userId: session.userId,
      tenantId: session.tenantId ?? null,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent,
      lastSeenAt: new Date(),
    },
    create: {
      userId: session.userId,
      tenantId: session.tenantId ?? null,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent,
      lastSeenAt: new Date(),
    },
  });
  return apiJson({ ok: true });
});

export const DELETE = handler(async (req: Request) => {
  await requireMerchant();
  const body = UnsubscribeBody.parse(await req.json());
  await prisma.merchantUserPushSubscription.deleteMany({
    where: { endpoint: body.endpoint },
  });
  return apiJson({ ok: true });
});
