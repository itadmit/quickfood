import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OpenSchema = z.object({
  opening_float: z.number().int().min(0).max(1_000_000),
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = OpenSchema.parse(await req.json());

  const user = await prisma.merchantUser.findUnique({
    where: { id: session.userId },
    select: { id: true, branchId: true, tenantId: true },
  });
  if (!user || user.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);

  let branchId = user.branchId;
  if (!branchId) {
    const primary = await prisma.branch.findFirst({
      where: { tenantId: session.tenantId, isPrimary: true },
      select: { id: true },
    });
    branchId = primary?.id ?? null;
  }
  if (!branchId) return apiError("no_branch", "אין סניף משויך", 422);

  // Reject double-open - one shift per cashier at a time.
  const existing = await prisma.posShift.findFirst({
    where: { cashierId: user.id, closedAt: null },
    select: { id: true },
  });
  if (existing) return apiError("shift_already_open", "כבר יש משמרת פתוחה", 409);

  const shift = await prisma.posShift.create({
    data: {
      tenantId: session.tenantId,
      branchId,
      cashierId: user.id,
      openingFloat: body.opening_float,
    },
    select: { id: true, openedAt: true, openingFloat: true },
  });

  return apiJson(
    {
      shift: {
        id: shift.id,
        opened_at: shift.openedAt.toISOString(),
        opening_float: shift.openingFloat,
      },
    },
    201,
  );
});
