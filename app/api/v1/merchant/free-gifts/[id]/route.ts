import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({
  item_id: z.string().uuid().optional(),
  min_subtotal: z.number().int().min(1).max(100000).optional(),
  active: z.boolean().optional(),
  valid_from: z.string().datetime().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
});

async function ownRule(id: string, tenantId: string) {
  const r = await prisma.freeGiftRule.findUnique({
    where: { id },
    select: { tenantId: true, validFrom: true, validUntil: true },
  });
  return r && r.tenantId === tenantId ? r : null;
}

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const existing = await ownRule(id, session.tenantId);
    if (!existing) return apiError("not_found", "הכלל לא נמצא", 404);
    const body = Patch.parse(await req.json());
    if (body.item_id) {
      const owned = await prisma.menuItem.count({
        where: { id: body.item_id, tenantId: session.tenantId },
      });
      if (owned !== 1) return apiError("forbidden", "המנה אינה של המסעדה", 403);
    }
    const from = body.valid_from !== undefined ? (body.valid_from ? new Date(body.valid_from) : null) : existing.validFrom;
    const until = body.valid_until !== undefined ? (body.valid_until ? new Date(body.valid_until) : null) : existing.validUntil;
    if (from && until && from >= until) {
      return apiError("validation_error", "תאריך הסיום חייב להיות אחרי תאריך ההתחלה", 400);
    }
    await prisma.freeGiftRule.update({
      where: { id },
      data: {
        ...(body.item_id !== undefined && { itemId: body.item_id }),
        ...(body.min_subtotal !== undefined && { minSubtotal: body.min_subtotal }),
        ...(body.active !== undefined && { active: body.active }),
        ...(body.valid_from !== undefined && { validFrom: from }),
        ...(body.valid_until !== undefined && { validUntil: until }),
      },
    });
    return apiJson({ ok: true });
  },
);

export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    if (!(await ownRule(id, session.tenantId))) return apiError("not_found", "הכלל לא נמצא", 404);
    await prisma.freeGiftRule.delete({ where: { id } });
    return apiJson({ ok: true });
  },
);
