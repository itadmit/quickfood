import { handler, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);

  const [tenant, categories] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { slug: true, name: true },
    }),
    prisma.menuCategory.findMany({
      where: { tenantId: session.tenantId },
      orderBy: { position: "asc" },
      include: {
        items: {
          orderBy: { position: "asc" },
          include: {
            sizes: { orderBy: { position: "asc" } },
            optionGroups: {
              orderBy: { position: "asc" },
              include: {
                options: { orderBy: { position: "asc" } },
                templateSet: { include: { options: { orderBy: { position: "asc" } } } },
              },
            },
          },
        },
      },
    }),
  ]);

  const headers = [
    "קטגוריה",
    "שם הפריט",
    "תיאור",
    "מחיר בסיס (₪)",
    "גדלים",
    "תוספות",
    "זמין",
    "מומלץ",
    "דקות הכנה",
    "תגיות",
    "מק״ט",
  ];

  const rows: string[][] = [];
  for (const cat of categories) {
    if (cat.items.length === 0) {
      rows.push([cat.name, "", "", "", "", "", "", "", "", "", ""]);
      continue;
    }
    for (const item of cat.items) {
      rows.push([
        cat.name,
        item.name,
        item.description ?? "",
        String(item.basePrice),
        formatSizes(item.sizes),
        formatGroups(item.optionGroups),
        item.available ? "כן" : "לא",
        item.featured ? "כן" : "לא",
        String(item.prepMinutes),
        (item.tags ?? []).join("; "),
        item.sku ?? "",
      ]);
    }
  }

  const body = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const csv = "﻿" + body;

  const stamp = new Date().toISOString().slice(0, 10);
  const base = (tenant?.slug || "menu").replace(/[^a-z0-9-]/gi, "-");
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="menu-${base}-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
});

function priceTag(delta: number): string {
  if (!delta) return "";
  return delta > 0 ? ` (+${delta})` : ` (${delta})`;
}

function formatSizes(sizes: { name: string; priceDelta: number; isDefault: boolean }[]): string {
  return sizes
    .map((s) => `${s.name}${priceTag(s.priceDelta)}${s.isDefault ? " (ברירת מחדל)" : ""}`)
    .join(" | ");
}

function formatGroups(
  groups: Array<{
    name: string;
    type: string;
    required: boolean;
    minSelect: number;
    maxSelect: number;
    options: Array<{ name: string; priceDelta: number; maxQuantity: number }>;
    templateSet: {
      name: string;
      type: string;
      required: boolean;
      minSelect: number;
      maxSelect: number;
      options: Array<{ name: string; priceDelta: number; maxQuantity: number }>;
    } | null;
  }>,
): string {
  return groups
    .map((g) => {
      const set = g.templateSet;
      const name = set?.name ?? g.name;
      const type = set?.type ?? g.type;
      const required = set?.required ?? g.required;
      const maxSelect = set?.maxSelect ?? g.maxSelect;
      const opts = set ? set.options : g.options;
      const rule =
        type === "single"
          ? required
            ? "חובה, בחירה יחידה"
            : "בחירה יחידה"
          : required
            ? `חובה, עד ${maxSelect}`
            : `עד ${maxSelect}`;
      const optText = opts
        .map((o) => `${o.name}${priceTag(o.priceDelta)}${o.maxQuantity ? ` (מקס׳ ${o.maxQuantity})` : ""}`)
        .join(", ");
      return `${name} [${rule}]: ${optText}`;
    })
    .join(" || ");
}

function csvCell(value: string): string {
  const v = value ?? "";
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
