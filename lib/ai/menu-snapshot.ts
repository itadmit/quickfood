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
        imageUrl: item.images?.[0] ?? null,
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

export function serializeMenuForPrompt(snapshot: AIMenuSnapshot): string {
  const lines: string[] = [];
  lines.push(`# תפריט ${snapshot.tenantName}`);
  if (snapshot.businessType) lines.push(`סוג עסק: ${snapshot.businessType}`);
  lines.push(``);

  const byCat = new Map<string, AIMenuItem[]>();
  for (const item of snapshot.items) {
    if (!byCat.has(item.category)) byCat.set(item.category, []);
    byCat.get(item.category)!.push(item);
  }

  for (const [cat, items] of byCat) {
    lines.push(`## ${cat}`);
    for (const item of items) {
      lines.push(
        `- id=${item.id} | "${item.name}" | מחיר ${item.basePrice}₪${item.description ? ` | ${item.description.slice(0, 80)}` : ""}${item.tags.length ? ` | תגיות: ${item.tags.join(",")}` : ""}`,
      );
      if (item.sizes.length > 0) {
        const sizeText = item.sizes
          .map((s) => `${s.name}=${s.id}(${s.priceDelta >= 0 ? "+" : ""}${s.priceDelta}₪${s.isDefault ? ",default" : ""})`)
          .join(", ");
        lines.push(`  מידות: ${sizeText}`);
      }
      for (const g of item.optionGroups) {
        const req = g.required ? "חובה" : "רשות";
        const range = `min=${g.minSelect}${g.maxSelect ? `,max=${g.maxSelect}` : ""}${g.includedFree ? `,חינם=${g.includedFree}` : ""}`;
        lines.push(`  קב' "${g.name}" [groupId=${g.id}, ${g.type}, ${req}, ${range}${g.allowHalf ? ", חצי-חצי" : ""}]`);
        for (const o of g.options) {
          lines.push(
            `    - id=${o.id} | "${o.name}" | ${o.priceDelta >= 0 ? "+" : ""}${o.priceDelta}₪${o.isDefault ? " | default" : ""}`,
          );
        }
      }
    }
    lines.push(``);
  }
  return lines.join("\n");
}
