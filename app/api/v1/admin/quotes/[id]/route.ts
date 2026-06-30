import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  clientName: z.string().trim().min(1).max(200).optional(),
  monthlyPrice: z.number().int().min(0).max(1_000_000).optional(),
  commissionStruck: z.string().trim().max(40).nullable().optional(),
  commissionActual: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(["sent", "signed"]).optional(),
});

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    const body = Patch.parse(await req.json());
    const existing = await prisma.proposal.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return apiError("not_found", "הצעה לא נמצאה", 404);

    const proposal = await prisma.proposal.update({
      where: { id },
      data: {
        ...(body.clientName !== undefined && { clientName: body.clientName }),
        ...(body.monthlyPrice !== undefined && { monthlyPrice: body.monthlyPrice }),
        ...(body.commissionStruck !== undefined && { commissionStruck: body.commissionStruck || null }),
        ...(body.commissionActual !== undefined && { commissionActual: body.commissionActual || null }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.status !== undefined && { status: body.status }),
      },
    });
    return apiJson({ proposal });
  },
);

export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await params;
    await prisma.proposal.deleteMany({ where: { id } });
    return apiJson({ ok: true });
  },
);
