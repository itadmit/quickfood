import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireCourier } from "@/lib/auth/courier-session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  amount: z.number().int().min(0).max(1000000).optional(),
  notes: z.string().max(200).optional(),
});

export const POST = handler(async (req: Request) => {
  const session = await requireCourier();
  const raw = await req.text();
  const body = raw ? Body.parse(JSON.parse(raw)) : {};

  const courier = await prisma.courier.findUnique({
    where: { id: session.courierId },
    select: { cashOnHand: true, tenantId: true },
  });
  if (!courier) return apiError("not_found", "שליח לא נמצא", 404);

  const amount = body.amount ?? courier.cashOnHand;
  if (amount <= 0) {
    return apiError("validation_error", "אין כסף לסגור", 422);
  }

  const newCashOnHand = Math.max(0, courier.cashOnHand - amount);

  const [, settlement] = await prisma.$transaction([
    prisma.courier.update({
      where: { id: session.courierId },
      data: { cashOnHand: newCashOnHand, lastSeenAt: new Date() },
    }),
    prisma.cashSettlement.create({
      data: {
        tenantId: courier.tenantId,
        courierId: session.courierId,
        amount,
        settledBy: "courier",
        settledById: session.courierId,
        notes: body.notes,
      },
    }),
  ]);

  return apiJson({
    settlement: { id: settlement.id, amount, created_at: settlement.createdAt.toISOString() },
    cash_on_hand: newCashOnHand,
  });
});
