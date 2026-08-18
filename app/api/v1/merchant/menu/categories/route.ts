import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CategoryInput = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().max(20).optional(),
  color: z.string().max(20).optional(),
  image_url: z.string().url().nullable().optional(),
  position: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  available_from: z.number().int().min(0).max(1439).nullable().optional(),
  available_to: z.number().int().min(0).max(1439).nullable().optional(),
  available_days: z.number().int().min(0).max(127).nullable().optional(),
  upsell_in_cart: z.boolean().default(false),
  upsell_before_checkout: z.boolean().default(false),
});

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const categories = await prisma.menuCategory.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { position: "asc" },
  });
  return apiJson({
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      image_url: c.imageUrl,
      position: c.position,
      active: c.active,
      available_from: c.availableFrom,
      available_to: c.availableTo,
      available_days: c.availableDays,
      upsell_in_cart: c.upsellInCart,
      upsell_before_checkout: c.upsellBeforeCheckout,
    })),
  });
});

export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = CategoryInput.parse(await req.json());
  const cat = await prisma.menuCategory.create({
    data: {
      tenantId: session.tenantId,
      name: body.name,
      icon: body.icon,
      color: body.color,
      imageUrl: body.image_url ?? null,
      position: body.position,
      active: body.active,
      availableFrom: body.available_from ?? null,
      availableTo: body.available_to ?? null,
      availableDays: body.available_days ?? null,
      upsellInCart: body.upsell_in_cart,
      upsellBeforeCheckout: body.upsell_before_checkout,
    },
  });
  return apiJson({ category: { id: cat.id, name: cat.name } }, 201);
});
