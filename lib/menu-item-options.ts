import { prisma } from "@/lib/db/client";

interface InlineOption {
  name: string;
  priceDelta: number;
  halfPriceDelta: number | null;
  isDefault: boolean;
  available: boolean;
  imageUrl: string | null;
  maxQuantity: number;
}

interface IncomingOption {
  name: string;
  price_delta: number;
  half_price_delta?: number | null;
  is_default: boolean;
  available: boolean;
  image_url?: string | null;
  max_quantity?: number;
}

interface IncomingGroup {
  template_set_id?: string | null;
  options: IncomingOption[];
}

export async function resolveGroupOptions(
  groups: IncomingGroup[],
): Promise<(g: IncomingGroup) => InlineOption[]> {
  const setIds = Array.from(
    new Set(groups.map((g) => g.template_set_id).filter((v): v is string => !!v)),
  );
  if (setIds.length === 0) {
    return (g) =>
      g.options.map((o) => ({
        name: o.name,
        priceDelta: o.price_delta,
        halfPriceDelta: o.half_price_delta ?? null,
        isDefault: o.is_default,
        available: o.available,
        imageUrl: o.image_url ?? null,
        maxQuantity: o.max_quantity ?? 0,
      }));
  }
  const rows = await prisma.modifierSetOption.findMany({
    where: { setId: { in: setIds } },
    orderBy: { position: "asc" },
    select: {
      setId: true,
      name: true,
      priceDelta: true,
      halfPriceDelta: true,
      isDefault: true,
      available: true,
      imageUrl: true,
      maxQuantity: true,
    },
  });
  const bySet = new Map<string, InlineOption[]>();
  for (const r of rows) {
    if (!bySet.has(r.setId)) bySet.set(r.setId, []);
    bySet.get(r.setId)!.push({
      name: r.name,
      priceDelta: r.priceDelta,
      halfPriceDelta: r.halfPriceDelta,
      isDefault: r.isDefault,
      available: r.available,
      imageUrl: r.imageUrl,
      maxQuantity: r.maxQuantity,
    });
  }
  return (g) => {
    if (g.template_set_id) {
      return bySet.get(g.template_set_id) ?? [];
    }
    return g.options.map((o) => ({
      name: o.name,
      priceDelta: o.price_delta,
      halfPriceDelta: o.half_price_delta ?? null,
      isDefault: o.is_default,
      available: o.available,
      imageUrl: o.image_url ?? null,
      maxQuantity: o.max_quantity ?? 0,
    }));
  };
}
