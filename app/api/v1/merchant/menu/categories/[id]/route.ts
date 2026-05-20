import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CategoryPatch = z.object({
  name: z.string().min(1).max(60).optional(),
  icon: z.string().max(20).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  position: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

async function loadOwn(id: string, tenantId: string) {
  const cat = await prisma.menuCategory.findUnique({ where: { id } });
  if (!cat || cat.tenantId !== tenantId) return null;
  return cat;
}

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const existing = await loadOwn(id, session.tenantId);
    if (!existing) return apiError("not_found", "קטגוריה לא נמצאה", 404);
    const body = CategoryPatch.parse(await req.json());
    const cat = await prisma.menuCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.icon !== undefined && { icon: body.icon }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.position !== undefined && { position: body.position }),
        ...(body.active !== undefined && { active: body.active }),
      },
    });
    return apiJson({
      category: {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        position: cat.position,
        active: cat.active,
      },
    });
  },
);

export const DELETE = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const existing = await loadOwn(id, session.tenantId);
    if (!existing) return apiError("not_found", "קטגוריה לא נמצאה", 404);
    const itemCount = await prisma.menuItem.count({ where: { categoryId: id } });
    if (itemCount > 0) {
      return apiError(
        "conflict",
        `לא ניתן למחוק — ${itemCount} פריטים משויכים`,
        409,
      );
    }
    await prisma.menuCategory.delete({ where: { id } });
    return apiJson({ ok: true });
  },
);
