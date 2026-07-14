// Registers (or refreshes) a native FCM token for the logged-in merchant.
// Auth reuses the qf_access cookie — the WebView and native layer share the jar.

import { z } from "zod";
import { handler, apiJson } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RegisterBody = z.object({
  fcmToken: z.string().min(20),
  platform: z.enum(["android", "ios"]),
  appVersion: z.string().optional(),
});

const UnregisterBody = z.object({
  fcmToken: z.string().min(20),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant();
  const body = RegisterBody.parse(await req.json());

  await prisma.nativeDeviceToken.upsert({
    where: { fcmToken: body.fcmToken },
    update: {
      userId: session.userId,
      tenantId: session.tenantId ?? null,
      platform: body.platform,
      appVersion: body.appVersion ?? null,
      lastSeenAt: new Date(),
    },
    create: {
      fcmToken: body.fcmToken,
      userId: session.userId,
      tenantId: session.tenantId ?? null,
      platform: body.platform,
      appVersion: body.appVersion ?? null,
      lastSeenAt: new Date(),
    },
  });

  return apiJson({ ok: true });
});

// Unregister on logout (optional).
export const DELETE = handler(async (req: Request) => {
  await requireMerchant();
  const body = UnregisterBody.parse(await req.json());
  await prisma.nativeDeviceToken.deleteMany({ where: { fcmToken: body.fcmToken } });
  return apiJson({ ok: true });
});
