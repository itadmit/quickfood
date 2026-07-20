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
  freeExtras: number;
  categoryId: string | null;
  slots: Array<{
    id: string;
    name: string;
    quantity: number;
    choices: Array<{
      itemId: string;
      fixedSizeId: string | null;
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
    free_extras: deal.freeExtras,
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
        fixedSizeId: c.fixedSizeId,
      })),
    })),
  };
}

export async function assertDealInputBelongsToTenant(
  body: z.infer<typeof DealInputSchema>,
  tenantId: string,
) {
  const ids = Array.from(new Set(body.slots.flatMap((s) => s.item_ids)));
  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids }, tenantId },
    select: { id: true, sizes: { select: { id: true } } },
  });
  if (items.length !== ids.length) {
    throw apiError("validation_error", "פריט לא שייך לחנות", 422, "slots");
  }
  // Each pinned size must be a real size of the item it's pinned to.
  const sizesByItem = new Map(items.map((i) => [i.id, new Set(i.sizes.map((s) => s.id))]));
  for (const s of body.slots) {
    for (const [itemId, sizeId] of Object.entries(s.fixed_sizes ?? {})) {
      if (!sizesByItem.get(itemId)?.has(sizeId)) {
        throw apiError("validation_error", "גודל קבוע לא תקין לפריט", 422, "slots");
      }
    }
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
