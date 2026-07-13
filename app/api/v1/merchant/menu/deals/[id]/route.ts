import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { DealInputSchema } from "@/lib/validate";
import { DEAL_INCLUDE, serializeDeal, assertDealInputBelongsToTenant } from "@/lib/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const deal = await prisma.deal.findUnique({ where: { id }, include: DEAL_INCLUDE });
  if (!deal || deal.tenantId !== session.tenantId) {
    return apiError("not_found", "דיל לא נמצא", 404);
  }
  return apiJson({ deal: serializeDeal(deal) });
});

export const PUT = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = DealInputSchema.parse(await req.json());

  const existing = await prisma.deal.findUnique({ where: { id }, select: { tenantId: true } });
  if (!existing) return apiError("not_found", "דיל לא נמצא", 404);
  if (existing.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);

  await assertDealInputBelongsToTenant(body, session.tenantId);

  await prisma.$transaction([
    prisma.dealSlot.deleteMany({ where: { dealId: id } }),
    prisma.deal.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        imageUrl: body.image_url ?? null,
        fixedPrice: body.fixed_price,
        active: body.active,
        position: body.position,
        freeExtras: body.free_extras,
        categoryId: body.category_id ?? null,
        slots: {
          create: body.slots.map((s, si) => ({
            name: s.name,
            quantity: s.quantity,
            position: si,
            choices: {
              create: s.item_ids.map((itemId, ii) => ({ itemId, position: ii })),
            },
          })),
        },
      },
    }),
  ]);

  const deal = await prisma.deal.findUnique({ where: { id }, include: DEAL_INCLUDE });
  return apiJson({ deal: serializeDeal(deal!) });
});

export const DELETE = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const existing = await prisma.deal.findUnique({ where: { id }, select: { tenantId: true } });
  if (!existing) return apiError("not_found", "דיל לא נמצא", 404);
  if (existing.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);
  await prisma.deal.delete({ where: { id } });
  return apiJson({ ok: true });
});
