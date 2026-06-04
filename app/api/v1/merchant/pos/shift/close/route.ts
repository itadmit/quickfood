import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { computeShiftSummary } from "@/lib/pos/shift-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CloseSchema = z.object({
  closing_float: z.number().int().min(0).max(1_000_000),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = CloseSchema.parse(await req.json());

  const shift = await prisma.posShift.findFirst({
    where: { cashierId: session.userId, closedAt: null },
    select: { id: true },
  });
  if (!shift) return apiError("no_open_shift", "אין משמרת פתוחה", 404);

  const summary = await computeShiftSummary(shift.id);

  await prisma.posShift.update({
    where: { id: shift.id },
    data: {
      closedAt: new Date(),
      closingFloat: body.closing_float,
      expectedCash: summary.expected_cash,
    },
  });

  return apiJson({
    ok: true,
    closing_float: body.closing_float,
    variance: body.closing_float - summary.expected_cash,
    summary,
  });
});
