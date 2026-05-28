import { prisma } from "@/lib/db/client";

interface InlineOption {
  name: string;
  priceDelta: number;
  isDefault: boolean;
  available: boolean;
  imageUrl: string | null;
}

interface IncomingOption {
  name: string;
  price_delta: number;
  is_default: boolean;
  available: boolean;
  image_url?: string | null;
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
        isDefault: o.is_default,
        available: o.available,
        imageUrl: o.image_url ?? null,
      }));
  }
  const rows = await prisma.modifierSetOption.findMany({
    where: { setId: { in: setIds } },
    orderBy: { position: "asc" },
    select: {
      setId: true,
      name: true,
      priceDelta: true,
      isDefault: true,
      available: true,
      imageUrl: true,
    },
  });
  const bySet = new Map<string, InlineOption[]>();
  for (const r of rows) {
    if (!bySet.has(r.setId)) bySet.set(r.setId, []);
    bySet.get(r.setId)!.push({
      name: r.name,
      priceDelta: r.priceDelta,
      isDefault: r.isDefault,
      available: r.available,
      imageUrl: r.imageUrl,
    });
  }
  return (g) => {
    if (g.template_set_id) {
      return bySet.get(g.template_set_id) ?? [];
    }
    return g.options.map((o) => ({
      name: o.name,
      priceDelta: o.price_delta,
      isDefault: o.is_default,
      available: o.available,
      imageUrl: o.image_url ?? null,
    }));
  };
}
