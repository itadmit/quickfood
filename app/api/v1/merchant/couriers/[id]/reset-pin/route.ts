import { z } from "zod";
import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "PIN חייב להיות 4-6 ספרות"),
});

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const c = await prisma.courier.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!c) return apiError("not_found", "שליח לא נמצא", 404);
    if (c.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);

    const { pin } = Body.parse(await req.json());
    const pinHash = await bcrypt.hash(pin, 10);
    await prisma.$transaction([
      prisma.courier.update({ where: { id }, data: { pinHash } }),
      prisma.courierSession.updateMany({
        where: { courierId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return apiJson({ ok: true });
  },
);
