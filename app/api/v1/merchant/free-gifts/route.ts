import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Automatic gift above a cart amount. See lib/free-gift.ts for the rules. */
const FreeGiftInput = z
  .object({
    item_id: z.string().uuid(),
    min_subtotal: z.number().int().min(1).max(100000),
    active: z.boolean().default(true),
    valid_from: z.string().datetime().nullable().optional(),
    valid_until: z.string().datetime().nullable().optional(),
  })
  .refine(
    (d) => !d.valid_from || !d.valid_until || new Date(d.valid_from) < new Date(d.valid_until),
    { message: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה", path: ["valid_until"] },
  );

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const rules = await prisma.freeGiftRule.findMany({
    where: { tenantId: session.tenantId },
    orderBy: [{ minSubtotal: "asc" }, { createdAt: "asc" }],
    include: { item: { select: { id: true, name: true, basePrice: true, available: true } } },
  });
  return apiJson({
    rules: rules.map((r) => ({
      id: r.id,
      item: r.item,
      min_subtotal: r.minSubtotal,
      active: r.active,
      valid_from: r.validFrom?.toISOString() ?? null,
      valid_until: r.validUntil?.toISOString() ?? null,
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = FreeGiftInput.parse(await req.json());
  // The gift dish must belong to this restaurant.
  const owned = await prisma.menuItem.count({
    where: { id: body.item_id, tenantId: session.tenantId },
  });
  if (owned !== 1) return apiError("forbidden", "המנה אינה של המסעדה", 403);
  const created = await prisma.freeGiftRule.create({
    data: {
      tenantId: session.tenantId,
      itemId: body.item_id,
      minSubtotal: body.min_subtotal,
      active: body.active,
      validFrom: body.valid_from ? new Date(body.valid_from) : null,
      validUntil: body.valid_until ? new Date(body.valid_until) : null,
    },
    select: { id: true },
  });
  return apiJson({ rule: { id: created.id } }, 201);
});
