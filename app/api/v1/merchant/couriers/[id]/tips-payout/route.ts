import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  amount: z.number().int().min(0).max(1000000).optional(),
});

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const courier = await prisma.courier.findUnique({
      where: { id },
      select: { tenantId: true, tipsOwed: true },
    });
    if (!courier) return apiError("not_found", "שליח לא נמצא", 404);
    if (courier.tenantId !== session.tenantId) {
      return apiError("forbidden", "אין הרשאה", 403);
    }

    const raw = await req.text();
    const body = raw ? Body.parse(JSON.parse(raw)) : {};
    const amount = body.amount ?? courier.tipsOwed;
    if (amount <= 0) {
      return apiError("validation_error", "אין טיפים לשלם", 422);
    }
    const newTipsOwed = Math.max(0, courier.tipsOwed - amount);

    await prisma.courier.update({
      where: { id },
      data: { tipsOwed: newTipsOwed },
    });

    return apiJson({ tips_owed: newTipsOwed, paid: amount });
  },
);
