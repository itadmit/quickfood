import { prisma } from "@/lib/db/client";

export interface AIMenuOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface AIMenuOptionGroup {
  id: string;
  name: string;
  type: string;
  required: boolean;
  minSelect: number;
  maxSelect: number | null;
  includedFree: number;
  allowHalf: boolean;
  helpText: string | null;
  options: AIMenuOption[];
}

export interface AIMenuSize {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface AIMenuItem {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  tags: string[];
  category: string;
  imageUrl: string | null;
  sizes: AIMenuSize[];
  optionGroups: AIMenuOptionGroup[];
}

export interface AIMenuSnapshot {
  tenantName: string;
  businessType: string | null;
  currency: string;
  items: AIMenuItem[];
}

export async function loadAIMenuSnapshot(tenantId: string): Promise<AIMenuSnapshot> {
  const [tenant, categories] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, businessType: true },
    }),
    prisma.menuCategory.findMany({
      where: { tenantId, active: true },
      orderBy: { position: "asc" },
      include: {
        items: {
          where: { available: true },
          orderBy: { position: "asc" },
          include: {
            sizes: { orderBy: { position: "asc" } },
            optionGroups: {
              orderBy: { position: "asc" },
              include: {
                options: { where: { available: true }, orderBy: { position: "asc" } },
                templateSet: {
                  include: {
                    options: { where: { available: true }, orderBy: { position: "asc" } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const items: AIMenuItem[] = [];
  for (const cat of categories) {
    for (const item of cat.items) {
      items.push({
        id: item.id,
        name: item.name,
        description: item.description,
        basePrice: item.basePrice,
        tags: item.tags,
        category: cat.name,
        imageUrl: item.images?.[0] ?? item.imageUrl ?? null,
        sizes: item.sizes.map((s) => ({
          id: s.id,
          name: s.name,
          priceDelta: s.priceDelta,
          isDefault: s.isDefault,
        })),
        optionGroups: item.optionGroups.map((g) => {
          const fromSet = g.templateSet;
          const opts = fromSet ? fromSet.options : g.options;
          return {
            id: g.id,
            name: fromSet?.name ?? g.name,
            type: fromSet?.type ?? g.type,
            required: fromSet?.required ?? g.required,
            minSelect: fromSet?.minSelect ?? g.minSelect,
            maxSelect: fromSet?.maxSelect ?? g.maxSelect,
            includedFree: fromSet?.includedFree ?? g.includedFree,
            helpText: fromSet?.helpText ?? g.helpText,
            allowHalf: g.allowHalf,
            options: opts.map((o) => ({
              id: o.id,
              name: o.name,
              priceDelta: o.priceDelta,
              isDefault: o.isDefault,
            })),
          };
        }),
      });
    }
  }

  return {
    tenantName: tenant?.name ?? "",
    businessType: tenant?.businessType ?? null,
    currency: "₪",
    items,
  };
}

export interface ShortIdMap {
  toReal: Record<string, string>;
  toShort: Record<string, string>;
}

export function buildShortIdMap(snapshot: AIMenuSnapshot): ShortIdMap {
  const toReal: Record<string, string> = {};
  const toShort: Record<string, string> = {};
  let n = 0;
  const assign = (real: string) => {
    if (toShort[real]) return toShort[real];
    n += 1;
    const short = "x" + n.toString(36);
    toReal[short] = real;
    toShort[real] = short;
    return short;
  };
  for (const item of snapshot.items) {
    assign(item.id);
    for (const s of item.sizes) assign(s.id);
    for (const g of item.optionGroups) {
      assign(g.id);
      for (const o of g.options) assign(o.id);
    }
  }
  return { toReal, toShort };
}

export function serializeMenuForPrompt(snapshot: AIMenuSnapshot, idMap: ShortIdMap): string {
  const lines: string[] = [];
  lines.push(`# תפריט ${snapshot.tenantName}`);
  if (snapshot.businessType) lines.push(`סוג: ${snapshot.businessType}`);
  lines.push(``);

  const byCat = new Map<string, AIMenuItem[]>();
  for (const item of snapshot.items) {
    if (!byCat.has(item.category)) byCat.set(item.category, []);
    byCat.get(item.category)!.push(item);
  }
  const m = idMap.toShort;

  for (const [cat, items] of byCat) {
    lines.push(`## ${cat}`);
    for (const item of items) {
      lines.push(
        `- ${m[item.id]}|${item.name}|${item.basePrice}₪${item.tags.length ? `|${item.tags.join(",")}` : ""}`,
      );
      if (item.sizes.length > 0) {
        const sizeText = item.sizes
          .map((s) => `${m[s.id]}=${s.name}(${s.priceDelta >= 0 ? "+" : ""}${s.priceDelta}${s.isDefault ? "*" : ""})`)
          .join(",");
        lines.push(`  מ:${sizeText}`);
      }
      for (const g of item.optionGroups) {
        const req = g.required ? "!" : "";
        const range = `${g.minSelect}-${g.maxSelect ?? "∞"}${g.includedFree ? `(${g.includedFree}חינם)` : ""}`;
        lines.push(`  ${m[g.id]}=${g.name}${req}[${range}${g.allowHalf ? ",½" : ""}]`);
        for (const o of g.options) {
          lines.push(
            `    ${m[o.id]}=${o.name}${o.priceDelta ? `(${o.priceDelta >= 0 ? "+" : ""}${o.priceDelta})` : ""}${o.isDefault ? "*" : ""}`,
          );
        }
      }
    }
    lines.push(``);
  }
  return lines.join("\n");
}
