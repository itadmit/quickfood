import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  amount: z.number().int().min(0).max(1000000).optional(),
  notes: z.string().max(200).optional(),
});

export const POST = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const courier = await prisma.courier.findUnique({
      where: { id },
      select: { tenantId: true, cashOnHand: true },
    });
    if (!courier) return apiError("not_found", "שליח לא נמצא", 404);
    if (courier.tenantId !== session.tenantId) {
      return apiError("forbidden", "אין הרשאה", 403);
    }

    const raw = await req.text();
    const body = raw ? Body.parse(JSON.parse(raw)) : {};
    const amount = body.amount ?? courier.cashOnHand;
    if (amount <= 0) {
      return apiError("validation_error", "אין כסף לסגור", 422);
    }
    const newCashOnHand = Math.max(0, courier.cashOnHand - amount);

    const [, settlement] = await prisma.$transaction([
      prisma.courier.update({
        where: { id },
        data: { cashOnHand: newCashOnHand },
      }),
      prisma.cashSettlement.create({
        data: {
          tenantId: session.tenantId,
          courierId: id,
          amount,
          settledBy: "merchant",
          settledById: session.userId,
          notes: body.notes,
        },
      }),
    ]);

    return apiJson({
      settlement: { id: settlement.id, amount, created_at: settlement.createdAt.toISOString() },
      cash_on_hand: newCashOnHand,
    });
  },
);

export const GET = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant();
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const courier = await prisma.courier.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!courier || courier.tenantId !== session.tenantId) {
      return apiError("not_found", "שליח לא נמצא", 404);
    }
    const { searchParams } = new URL(req.url);
    const take = Math.min(parseInt(searchParams.get("limit") ?? "20") || 20, 100);
    const rows = await prisma.cashSettlement.findMany({
      where: { courierId: id },
      orderBy: { createdAt: "desc" },
      take,
    });
    return apiJson({
      settlements: rows.map((r) => ({
        id: r.id,
        amount: r.amount,
        settled_by: r.settledBy,
        notes: r.notes,
        created_at: r.createdAt.toISOString(),
      })),
    });
  },
);
