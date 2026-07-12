import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { DealInputSchema } from "@/lib/validate";
import { DEAL_INCLUDE, serializeDeal, assertDealInputBelongsToTenant } from "@/lib/deals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const deals = await prisma.deal.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: DEAL_INCLUDE,
  });

  return apiJson({ deals: deals.map(serializeDeal) });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const body = DealInputSchema.parse(await req.json());
  await assertDealInputBelongsToTenant(body, session.tenantId);

  const deal = await prisma.deal.create({
    data: {
      tenantId: session.tenantId,
      name: body.name,
      description: body.description,
      imageUrl: body.image_url ?? null,
      fixedPrice: body.fixed_price,
      active: body.active,
      position: body.position,
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
    include: DEAL_INCLUDE,
  });

  return apiJson({ deal: serializeDeal(deal) }, 201);
});
