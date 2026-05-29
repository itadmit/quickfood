import { z } from "zod";
import { handler, apiJson } from "@/lib/api-response";
import { requireCourier } from "@/lib/auth/courier-session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  status: z.enum(["available", "break_time", "offline"]),
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireCourier();
  const { status } = Body.parse(await req.json());
  await prisma.courier.update({
    where: { id: session.courierId },
    data: { status, lastSeenAt: new Date() },
  });
  return apiJson({ ok: true, status });
});
