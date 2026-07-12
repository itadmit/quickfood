import { prisma } from "@/lib/db/client";
import { apiError } from "@/lib/api-response";
import type { z } from "zod";
import type { DealInputSchema } from "@/lib/validate";

export const DEAL_INCLUDE = {
  slots: {
    orderBy: { position: "asc" as const },
    include: {
      choices: {
        orderBy: { position: "asc" as const },
        include: {
          item: {
            select: { id: true, name: true, basePrice: true, available: true, images: true },
          },
        },
      },
    },
  },
};

export interface DealWithSlots {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  fixedPrice: number;
  active: boolean;
  position: number;
  categoryId: string | null;
  slots: Array<{
    id: string;
    name: string;
    quantity: number;
    choices: Array<{
      itemId: string;
      item: { id: string; name: string; basePrice: number; available: boolean; images: string[] };
    }>;
  }>;
}

export function serializeDeal(deal: DealWithSlots) {
  return {
    id: deal.id,
    name: deal.name,
    description: deal.description,
    image_url: deal.imageUrl,
    fixed_price: deal.fixedPrice,
    active: deal.active,
    position: deal.position,
    category_id: deal.categoryId,
    slots: deal.slots.map((s) => ({
      id: s.id,
      name: s.name,
      quantity: s.quantity,
      items: s.choices.map((c) => ({
        id: c.item.id,
        name: c.item.name,
        base_price: c.item.basePrice,
        available: c.item.available,
        image: c.item.images[0] ?? null,
      })),
    })),
  };
}

export async function assertDealInputBelongsToTenant(
  body: z.infer<typeof DealInputSchema>,
  tenantId: string,
) {
  const ids = Array.from(new Set(body.slots.flatMap((s) => s.item_ids)));
  const count = await prisma.menuItem.count({ where: { id: { in: ids }, tenantId } });
  if (count !== ids.length) {
    throw apiError("validation_error", "פריט לא שייך לחנות", 422, "slots");
  }
  if (body.category_id) {
    const cat = await prisma.menuCategory.findUnique({
      where: { id: body.category_id },
      select: { tenantId: true },
    });
    if (!cat || cat.tenantId !== tenantId) {
      throw apiError("validation_error", "קטגוריה לא תקינה", 422, "category_id");
    }
  }
}
