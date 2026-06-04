import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CashOutSchema = z.object({
  amount: z.number().int().min(1).max(1_000_000),
  reason: z.string().max(120).optional(),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = CashOutSchema.parse(await req.json());

  const shift = await prisma.posShift.findFirst({
    where: { cashierId: session.userId, closedAt: null },
    select: { id: true, cashOutNotes: true },
  });
  if (!shift) return apiError("no_open_shift", "אין משמרת פתוחה", 404);

  const notes = Array.isArray(shift.cashOutNotes) ? (shift.cashOutNotes as unknown[]) : [];
  notes.push({ ts: new Date().toISOString(), amount: body.amount, reason: body.reason ?? null });

  await prisma.posShift.update({
    where: { id: shift.id },
    data: { cashOutNotes: notes as unknown as Prisma.InputJsonValue },
  });

  return apiJson({ ok: true });
});
