import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { computeShiftSummary } from "@/lib/pos/shift-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const url = new URL(req.url);
  const includeSummary = url.searchParams.get("include_summary") === "1";

  const shift = await prisma.posShift.findFirst({
    where: { cashierId: session.userId, closedAt: null },
    select: {
      id: true,
      openedAt: true,
      openingFloat: true,
      cashOutNotes: true,
    },
  });

  if (!shift) return apiJson({ shift: null });

  const out: Record<string, unknown> = {
    shift: {
      id: shift.id,
      opened_at: shift.openedAt.toISOString(),
      opening_float: shift.openingFloat,
      cash_out_notes: shift.cashOutNotes,
    },
  };
  if (includeSummary) {
    out.summary = await computeShiftSummary(shift.id);
  }
  return apiJson(out);
});
