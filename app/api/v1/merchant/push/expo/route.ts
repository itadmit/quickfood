import { z } from "zod";
import { handler, apiJson } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RegisterBody = z.object({
  token: z.string().min(10).max(255),
  platform: z.enum(["ios", "android"]).optional(),
  deviceName: z.string().max(120).optional(),
});

const UnregisterBody = z.object({
  token: z.string().min(10).max(255),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant();
  const body = RegisterBody.parse(await req.json());

  await prisma.merchantExpoPushToken.upsert({
    where: { token: body.token },
    update: {
      userId: session.userId,
      tenantId: session.tenantId ?? null,
      platform: body.platform ?? null,
      deviceName: body.deviceName ?? null,
      lastSeenAt: new Date(),
    },
    create: {
      userId: session.userId,
      tenantId: session.tenantId ?? null,
      token: body.token,
      platform: body.platform ?? null,
      deviceName: body.deviceName ?? null,
      lastSeenAt: new Date(),
    },
  });

  return apiJson({ ok: true });
});

export const DELETE = handler(async (req: Request) => {
  await requireMerchant();
  const body = UnregisterBody.parse(await req.json());
  await prisma.merchantExpoPushToken.deleteMany({
    where: { token: body.token },
  });
  return apiJson({ ok: true });
});
