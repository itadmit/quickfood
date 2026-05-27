import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { resolveTenantBySlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  tenant_slug: z.string().min(1),
  item_id: z.string().min(1),
  quantity: z.number().int().min(1).max(20).optional(),
  size_id: z.string().nullable().optional(),
  option_ids: z.array(z.string()).optional(),
  notes: z.string().max(200).optional(),
});

export const POST = handler(async (req: Request) => {
  const body = Schema.parse(await req.json());
  const tenant = await resolveTenantBySlug(body.tenant_slug);
  if (!tenant) return apiError("not_found", "tenant not found", 404);

  const item = await prisma.menuItem.findFirst({
    where: { id: body.item_id, tenantId: tenant.id, available: true },
    include: {
      sizes: true,
      optionGroups: {
        include: {
          options: true,
          templateSet: { include: { options: true } },
        },
      },
    },
  });
  if (!item) return apiError("item_not_found", "פריט לא קיים", 404);

  let sizeId: string | null = null;
  let sizeName: string | null = null;
  let sizeDelta = 0;

  if (item.sizes.length > 0) {
    const picked = body.size_id
      ? item.sizes.find((s) => s.id === body.size_id)
      : (item.sizes.find((s) => s.isDefault) ?? item.sizes[0]);
    if (!picked) return apiError("size_required", "מידה לא תקפה", 400);
    sizeId = picked.id;
    sizeName = picked.name;
    sizeDelta = picked.priceDelta;
  }

  const requestedOptions = new Set(body.option_ids ?? []);
  const selectedOptions: Array<{ groupId: string; optionId: string; name: string; priceDelta: number }> = [];

  for (const g of item.optionGroups) {
    const fromSet = g.templateSet;
    const opts = fromSet ? fromSet.options : g.options;
    const required = fromSet?.required ?? g.required;
    const minSelect = fromSet?.minSelect ?? g.minSelect;
    const maxSelect = fromSet?.maxSelect ?? g.maxSelect;

    const picksFromUser = opts.filter((o) => requestedOptions.has(o.id) && o.available);
    let picks = picksFromUser;

    if (picks.length === 0 && required) {
      const defaults = opts.filter((o) => o.isDefault && o.available);
      if (defaults.length >= minSelect) {
        picks = defaults.slice(0, maxSelect ?? defaults.length);
      } else if (opts.length > 0) {
        picks = opts.slice(0, Math.max(minSelect, 1));
      }
    }

    if (maxSelect && picks.length > maxSelect) {
      picks = picks.slice(0, maxSelect);
    }

    for (const p of picks) {
      selectedOptions.push({
        groupId: g.id,
        optionId: p.id,
        name: p.name,
        priceDelta: p.priceDelta,
      });
    }
  }

  const optionsSum = selectedOptions.reduce((a, o) => a + o.priceDelta, 0);
  const unitPrice = item.basePrice + sizeDelta + optionsSum;

  return apiJson({
    proposal: {
      itemId: item.id,
      itemName: item.name,
      basePrice: item.basePrice,
      quantity: body.quantity ?? 1,
      sizeId,
      sizeName,
      sizeDelta,
      options: selectedOptions,
      notes: body.notes ?? null,
      imageUrl: item.images?.[0] ?? null,
      unitPrice,
    },
  });
});
