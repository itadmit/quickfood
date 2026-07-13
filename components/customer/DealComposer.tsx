"use client";

import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/customer/CartProvider";
import { ItemDetailModal } from "@/components/customer/ItemDetailModal";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface ComposerOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}
interface ComposerGroup {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  includedFree?: number;
  options: ComposerOption[];
}
interface ComposerItem {
  id: string;
  name: string;
  basePrice: number;
  artType: string | null;
  images?: string[];
  optionGroups: ComposerGroup[];
}
interface ComposerChoice {
  id: string;
  name: string;
  image: string | null;
  available: boolean;
}
interface ComposerDeal {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  fixedPrice: number;
  slots: Array<{
    id: string;
    name: string;
    quantity: number;
    itemIds: string[];
    choices?: ComposerChoice[];
  }>;
}

/** One selection row = one slot unit ("מנה 1", "מנה 2", "שתייה"...). */
interface UnitSel {
  slotId: string;
  label: string;
  itemId: string | null;
  optionIds: Set<string>;
}

/** Effective charge per picked option, mirroring the server's allocation in
 *  priceGroupOptions: the cheapest `includedFree` PAID picks are free,
 *  zero/negative-delta picks are unaffected. Returned map keeps the preview
 *  identical to what the order will actually charge. */
function groupCharges(group: ComposerGroup, picked: Set<string>): Map<string, number> {
  const chosen = group.options.filter((o) => picked.has(o.id));
  const free = group.includedFree ?? 0;
  const paid = chosen.filter((o) => o.priceDelta > 0).sort((a, b) => a.priceDelta - b.priceDelta);
  const out = new Map<string, number>();
  paid.forEach((o, i) => out.set(o.id, i < free ? 0 : o.priceDelta));
  for (const o of chosen) if (o.priceDelta <= 0) out.set(o.id, o.priceDelta);
  return out;
}

function groupExtras(group: ComposerGroup, picked: Set<string>): number {
  let sum = 0;
  for (const v of groupCharges(group, picked).values()) sum += v;
  return sum;
}

export function DealComposer({
  tenantSlug,
  businessType = "general",
  dealId,
  onClose,
}: {
  tenantSlug: string;
  businessType?: BusinessType;
  dealId: string;
  onClose: () => void;
}) {
  const { add } = useCart();
  const [deal, setDeal] = useState<ComposerDeal | null>(null);
  const [items, setItems] = useState<Record<string, ComposerItem>>({});
  const [units, setUnits] = useState<UnitSel[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/v1/customer/deal?slug=${encodeURIComponent(tenantSlug)}&id=${encodeURIComponent(dealId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!alive) return;
        setDeal(d.deal);
        setItems(d.items);
        const expanded: UnitSel[] = [];
        for (const slot of d.deal.slots as ComposerDeal["slots"]) {
          for (let i = 0; i < slot.quantity; i++) {
            expanded.push({
              slotId: slot.id,
              label: slot.quantity > 1 ? `${slot.name} ${i + 1}` : slot.name,
              itemId: slot.itemIds.length === 1 ? slot.itemIds[0] : null,
              optionIds: new Set(),
            });
          }
        }
        setUnits(expanded);
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tenantSlug, dealId]);

  // Cards to render per slot, unavailable items included (dimmed, blocked).
  // Older cached payloads without `choices` degrade to available-only.
  const slotChoices = useMemo(() => {
    const m = new Map<string, ComposerChoice[]>();
    for (const s of deal?.slots ?? []) {
      m.set(
        s.id,
        s.choices ??
          s.itemIds.map((id) => ({
            id,
            name: items[id]?.name ?? "",
            image: items[id]?.images?.[0] ?? null,
            available: true,
          })),
      );
    }
    return m;
  }, [deal, items]);

  function pickItem(unitIdx: number, itemId: string) {
    setUnits((prev) =>
      prev.map((u, i) =>
        i === unitIdx ? { ...u, itemId, optionIds: new Set<string>() } : u,
      ),
    );
  }

  function toggleOption(unitIdx: number, group: ComposerGroup, optionId: string) {
    setUnits((prev) =>
      prev.map((u, i) => {
        if (i !== unitIdx) return u;
        const next = new Set(u.optionIds);
        if (group.type === "single") {
          for (const o of group.options) next.delete(o.id);
          next.add(optionId);
        } else if (next.has(optionId)) {
          next.delete(optionId);
        } else {
          const pickedInGroup = group.options.filter((o) => next.has(o.id)).length;
          if (pickedInGroup >= group.maxSelect) return u;
          next.add(optionId);
        }
        return { ...u, optionIds: next };
      }),
    );
  }

  const extras = useMemo(() => {
    let sum = 0;
    for (const u of units) {
      if (!u.itemId) continue;
      const item = items[u.itemId];
      if (!item) continue;
      for (const g of item.optionGroups) sum += groupExtras(g, u.optionIds);
    }
    return sum;
  }, [units, items]);

  const incomplete = useMemo(() => {
    for (const u of units) {
      if (!u.itemId) return true;
      const item = items[u.itemId];
      if (!item) return true;
      for (const g of item.optionGroups) {
        const picked = g.options.filter((o) => u.optionIds.has(o.id)).length;
        const floor = g.required ? Math.max(1, g.minSelect) : g.minSelect;
        if (g.required && picked < floor) return true;
      }
    }
    return units.length === 0;
  }, [units, items]);

  const total = (deal?.fixedPrice ?? 0) + extras;

  function addToCart() {
    if (!deal || incomplete || added) return;
    const displayOptions: Array<{ groupId: string; optionId: string; name: string; groupName?: string; priceDelta: number }> = [];
    for (const u of units) {
      const item = items[u.itemId!];
      displayOptions.push({
        groupId: u.slotId,
        optionId: item.id,
        name: item.name,
        groupName: u.label,
        priceDelta: 0,
      });
      for (const g of item.optionGroups) {
        const charges = groupCharges(g, u.optionIds);
        for (const o of g.options) {
          if (!u.optionIds.has(o.id)) continue;
          displayOptions.push({
            groupId: g.id,
            optionId: o.id,
            name: o.name,
            groupName: `${u.label} · ${g.name}`,
            priceDelta: charges.get(o.id) ?? 0,
          });
        }
      }
    }
    add({
      itemId: deal.id,
      name: deal.name,
      basePrice: deal.fixedPrice,
      artType: null,
      imageUrl: deal.imageUrl ?? (units[0]?.itemId ? items[units[0].itemId!]?.images?.[0] ?? null : null),
      quantity: 1,
      sizeId: null,
      sizeName: null,
      sizeDelta: 0,
      options: displayOptions,
      notes: null,
      source: "menu",
      deal: {
        dealId: deal.id,
        units: units.map((u) => ({
          slotId: u.slotId,
          itemId: u.itemId!,
          optionIds: Array.from(u.optionIds),
        })),
      },
    });
    setAdded(true);
    window.setTimeout(onClose, 350);
  }

  return (
    <ItemDetailModal onClose={onClose}>
      {loading ? (
        <div className="p-10 text-center text-sm text-qf-mute">טוען דיל...</div>
      ) : failed || !deal ? (
        <div className="p-10 text-center text-sm text-qf-mute">הדיל לא זמין כרגע</div>
      ) : (
        <div className="pb-28">
          <div className="relative h-44 sm:h-56 overflow-hidden bg-qf-line-soft">
            <MenuItemImage
              src={deal.imageUrl ?? undefined}
              alt={deal.name}
              businessType={businessType}
              size={520}
              rounded="none"
              fill
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-linear-to-t from-black/40 to-transparent pointer-events-none" />
            <div className="absolute bottom-3 start-4 text-white">
              <div className="font-bold text-xl leading-tight drop-shadow">{deal.name}</div>
              <div className="text-sm opacity-90 drop-shadow">{formatPrice(deal.fixedPrice)} מחיר קבוע</div>
            </div>
          </div>

          {deal.description && (
            <p className="px-5 pt-3 text-sm text-qf-ink2 leading-snug">{deal.description}</p>
          )}

          <div className="px-5 py-4 space-y-5">
            {units.map((u, ui) => {
              const choices = slotChoices.get(u.slotId) ?? [];
              const chosen = u.itemId ? items[u.itemId] : null;
              return (
                <section key={`${u.slotId}-${ui}`} className="space-y-2.5">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-(--qf-primary) text-white grid place-items-center text-xs font-bold shrink-0">
                      {ui + 1}
                    </span>
                    {u.label}
                    <span className="text-qf-tomato text-xs">*</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    {choices.map((it) => {
                      const active = u.itemId === it.id;
                      if (!it.available) {
                        return (
                          <div
                            key={it.id}
                            aria-disabled="true"
                            className="relative flex items-center gap-2 rounded-xl border-2 border-qf-line bg-white p-2 opacity-45"
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                              <MenuItemImage
                                src={it.image ?? undefined}
                                alt={it.name}
                                businessType={businessType}
                                size={40}
                                rounded="lg"
                                className="w-full h-full"
                              />
                            </div>
                            <span className="text-sm font-medium leading-tight flex-1 min-w-0">
                              {it.name}
                            </span>
                            <span className="absolute top-1.5 start-1.5 text-[10px] font-bold bg-qf-ink text-white px-1.5 py-0.5 rounded-md">
                              לא זמין כעת
                            </span>
                          </div>
                        );
                      }
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => pickItem(ui, it.id)}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border-2 p-2 text-start transition",
                            active
                              ? "border-(--qf-primary) bg-(--qf-primary)/5"
                              : "border-qf-line bg-white hover:border-qf-mute",
                          )}
                          aria-pressed={active}
                        >
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                            <MenuItemImage
                              src={it.image ?? undefined}
                              alt={it.name}
                              businessType={businessType}
                              size={40}
                              rounded="lg"
                              className="w-full h-full"
                            />
                          </div>
                          <span className="text-sm font-medium leading-tight flex-1 min-w-0">
                            {it.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {chosen &&
                    chosen.optionGroups.map((g) => {
                      const picked = g.options.filter((o) => u.optionIds.has(o.id)).length;
                      const floor = g.required ? Math.max(1, g.minSelect) : g.minSelect;
                      const missing = g.required && picked < floor;
                      const atMax = g.type === "multi" && picked >= g.maxSelect;
                      return (
                      <div key={g.id} className="rounded-xl bg-qf-line-soft/40 border border-qf-line p-3 space-y-1.5">
                        <div className="text-xs font-semibold text-qf-ink2 flex items-center gap-1.5">
                          {g.name}
                          {g.required && <span className="text-qf-tomato">*</span>}
                          {(g.includedFree ?? 0) > 0 && (
                            <span className="text-[10px] text-qf-mute font-normal">
                              ({g.includedFree} כלולות במחיר)
                            </span>
                          )}
                          {g.type === "multi" && (
                            <span
                              className={cn(
                                "ms-auto text-[10px] tnum font-bold px-1.5 py-0.5 rounded-md",
                                atMax
                                  ? "bg-(--qf-primary) text-white"
                                  : "bg-white border border-qf-line text-qf-mute font-normal",
                              )}
                            >
                              {picked}/{g.maxSelect}
                            </span>
                          )}
                        </div>
                        {(missing || atMax) && (
                          <div
                            className={cn(
                              "text-[10px]",
                              missing ? "text-qf-tomato font-medium" : "text-qf-mute",
                            )}
                          >
                            {missing
                              ? floor > 1
                                ? `חובה לבחור לפחות ${floor} אפשרויות`
                                : "חובה לבחור אפשרות אחת"
                              : "הגעתם למקסימום - להחלפה בטלו בחירה קודמת"}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {g.options.map((o) => {
                            const active = u.optionIds.has(o.id);
                            return (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => toggleOption(ui, g, o.id)}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-xs border transition",
                                  active
                                    ? "bg-(--qf-primary) text-white border-(--qf-primary)"
                                    : "bg-white text-qf-ink2 border-qf-line hover:border-qf-mute",
                                )}
                                aria-pressed={active}
                              >
                                {o.name}
                                {o.priceDelta > 0 && (
                                  <span className={cn("ms-1 tnum", active ? "text-white/80" : "text-qf-mute")}>
                                    +₪{o.priceDelta}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      );
                    })}
                </section>
              );
            })}
          </div>

          <div className="fixed bottom-0 inset-x-0 sm:absolute bg-white border-t border-qf-line p-4 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-bold text-lg tnum">{formatPrice(total)}</div>
              {extras > 0 && (
                <div className="text-[11px] text-qf-mute tnum">
                  {formatPrice(deal.fixedPrice)} + {formatPrice(extras)} תוספות
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={addToCart}
              disabled={incomplete || added}
              className="h-12 px-6 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-bold text-sm disabled:opacity-50 transition"
            >
              {added ? "נוסף לסל" : incomplete ? "השלימו את הבחירות" : "הוסיפו לסל"}
            </button>
          </div>
        </div>
      )}
    </ItemDetailModal>
  );
}
