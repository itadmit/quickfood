import { z } from "zod";
import { handler, apiJson } from "@/lib/api-response";
import { requireCourier } from "@/lib/auth/courier-session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

export const POST = handler(async (req: Request) => {
  const session = await requireCourier();
  const { lat, lng } = Body.parse(await req.json());
  await prisma.courier.update({
    where: { id: session.courierId },
    data: {
      currentLat: lat,
      currentLng: lng,
      lastSeenAt: new Date(),
    },
  });
  return apiJson({ ok: true });
});
