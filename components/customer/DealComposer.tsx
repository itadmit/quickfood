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
  /** Per-option quantity ceiling for allowQty groups. 0 = no per-option cap
   *  (the group's maxSelect still bounds the total). */
  maxQuantity?: number;
}
interface ComposerGroup {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  includedFree?: number;
  /** Wolt-style "same topping multiple times" - shows a +/- stepper per
   *  picked option (multi groups only), exactly like a normal item. */
  allowQty?: boolean;
  options: ComposerOption[];
}
interface ComposerSize {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}
interface ComposerItem {
  id: string;
  name: string;
  basePrice: number;
  compareAtPrice?: number | null;
  artType: string | null;
  images?: string[];
  sizes?: ComposerSize[];
  optionGroups: ComposerGroup[];
}
interface ComposerChoice {
  id: string;
  name: string;
  image: string | null;
  available: boolean;
  /** When set, this item is pinned to a specific size in the deal - the
   *  customer doesn't choose, and the size delta is NOT charged (the fixed
   *  price already accounts for it). */
  fixedSizeId?: string | null;
}
interface ComposerDeal {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  fixedPrice: number;
  freeExtras?: number;
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
  sizeId: string | null;
  optionIds: Set<string>;
  /** Per-option quantity for allowQty groups (optionId → count). A picked
   *  option with no entry here is quantity 1. Ignored for non-allowQty
   *  groups, which stay one-unit-each exactly as before. */
  qtys: Record<string, number>;
}

/** Units of a picked option: 1 unless the group is allowQty/multi, then the
 *  tracked quantity. Mirrors ItemDetail.optionQty so the preview and payload
 *  match a normal item. */
function unitOptionQty(group: ComposerGroup, u: UnitSel, optionId: string): number {
  if (!u.optionIds.has(optionId)) return 0;
  if (!group.allowQty || group.type !== "multi" || group.maxSelect <= 1) return 1;
  return Math.max(1, u.qtys[optionId] ?? 1);
}

/** Total units picked in a group (sum of per-option quantities). Equals the
 *  distinct count for non-allowQty groups. Bounds maxSelect / required. */
function groupTotalUnits(group: ComposerGroup, u: UnitSel): number {
  let n = 0;
  for (const o of group.options) n += unitOptionQty(group, u, o.id);
  return n;
}

/** The item's default size id (or its first size), null when it has no sizes. */
function defaultSizeId(item: ComposerItem | undefined): string | null {
  if (!item?.sizes?.length) return null;
  return (item.sizes.find((s) => s.isDefault) ?? item.sizes[0]).id;
}

/** Effective charge per picked option, mirroring the server's allocation in
 *  priceGroupOptions: the cheapest `includedFree` PAID picks are free,
 *  zero/negative-delta picks are unaffected. Returned map keeps the preview
 *  identical to what the order will actually charge. */
function groupCharges(group: ComposerGroup, u: UnitSel): Map<string, number> {
  const free = group.includedFree ?? 0;
  // One entry per UNIT (an option picked 3× contributes three units), so the
  // cheapest-free allocation matches the server's per-unit pricing.
  const paid: Array<{ id: string; price: number }> = [];
  const out = new Map<string, number>();
  for (const o of group.options) {
    const qty = unitOptionQty(group, u, o.id);
    if (qty === 0) continue;
    for (let i = 0; i < qty; i++) {
      if (o.priceDelta > 0) paid.push({ id: o.id, price: o.priceDelta });
      else out.set(o.id, (out.get(o.id) ?? 0) + o.priceDelta);
    }
  }
  paid.sort((a, b) => a.price - b.price);
  paid.forEach((unit, i) => {
    const charge = i < free ? 0 : unit.price;
    out.set(unit.id, (out.get(unit.id) ?? 0) + charge);
  });
  return out;
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
            const preItemId = slot.itemIds.length === 1 ? slot.itemIds[0] : null;
            const preLocked = preItemId
              ? (slot.choices ?? []).find((c) => c.id === preItemId)?.fixedSizeId ?? null
              : null;
            expanded.push({
              slotId: slot.id,
              label: slot.quantity > 1 ? `${slot.name} ${i + 1}` : slot.name,
              itemId: preItemId,
              sizeId: preItemId ? (preLocked ?? defaultSizeId(d.items[preItemId])) : null,
              optionIds: new Set(),
              qtys: {},
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

  /** Pinned size for a (slot, item) pair, null when the customer chooses. */
  function lockedSizeId(slotId: string, itemId: string): string | null {
    return slotChoices.get(slotId)?.find((c) => c.id === itemId)?.fixedSizeId ?? null;
  }

  function pickItem(unitIdx: number, itemId: string) {
    setUnits((prev) =>
      prev.map((u, i) => {
        if (i !== unitIdx) return u;
        const locked = lockedSizeId(u.slotId, itemId);
        return {
          ...u,
          itemId,
          sizeId: locked ?? defaultSizeId(items[itemId]),
          optionIds: new Set<string>(),
          qtys: {},
        };
      }),
    );
  }

  function pickSize(unitIdx: number, sizeId: string) {
    setUnits((prev) => prev.map((u, i) => (i === unitIdx ? { ...u, sizeId } : u)));
  }

  function toggleOption(unitIdx: number, group: ComposerGroup, optionId: string) {
    setUnits((prev) =>
      prev.map((u, i) => {
        if (i !== unitIdx) return u;
        const next = new Set(u.optionIds);
        const qtys = { ...u.qtys };
        if (group.type === "single") {
          for (const o of group.options) {
            next.delete(o.id);
            delete qtys[o.id];
          }
          next.add(optionId);
        } else if (next.has(optionId)) {
          next.delete(optionId);
          delete qtys[optionId];
        } else {
          if (groupTotalUnits(group, u) >= group.maxSelect) return u;
          next.add(optionId);
        }
        return { ...u, optionIds: next, qtys };
      }),
    );
  }

  /** +/- a picked option's quantity in an allowQty group. Respects the group's
   *  total maxSelect and the option's own maxQuantity; stepping down to 0
   *  removes the pick. */
  function bumpOptionQty(unitIdx: number, group: ComposerGroup, optionId: string, delta: 1 | -1) {
    setUnits((prev) =>
      prev.map((u, i) => {
        if (i !== unitIdx) return u;
        const cur = unitOptionQty(group, u, optionId);
        if (delta > 0) {
          if (groupTotalUnits(group, u) >= group.maxSelect) return u;
          const cap = group.options.find((o) => o.id === optionId)?.maxQuantity ?? 0;
          if (cap > 0 && cur >= cap) return u;
        }
        const nextQty = cur + delta;
        const next = new Set(u.optionIds);
        const qtys = { ...u.qtys };
        if (nextQty <= 0) {
          next.delete(optionId);
          delete qtys[optionId];
        } else {
          next.add(optionId);
          qtys[optionId] = nextQty;
        }
        return { ...u, optionIds: next, qtys };
      }),
    );
  }

  // Effective charge per picked option across the whole deal, mirroring the
  // server: per-group pricing first, then the deal's gifted extras zero the
  // N cheapest remaining paid picks. Keyed "unitIdx:groupId:optionId".
  const chargeByPick = useMemo(() => {
    const perKey = new Map<string, number>();
    const positive: Array<{ key: string; charge: number }> = [];
    units.forEach((u, ui) => {
      if (!u.itemId) return;
      const item = items[u.itemId];
      if (!item) return;
      for (const g of item.optionGroups) {
        for (const [oid, charge] of groupCharges(g, u)) {
          const key = `${ui}:${g.id}:${oid}`;
          perKey.set(key, charge);
          if (charge > 0) positive.push({ key, charge });
        }
      }
    });
    const gifted = deal?.freeExtras ?? 0;
    if (gifted > 0) {
      positive.sort((a, b) => a.charge - b.charge);
      for (const p of positive.slice(0, gifted)) perKey.set(p.key, 0);
    }
    return perKey;
  }, [deal, units, items]);

  const extras = useMemo(() => {
    let sum = 0;
    for (const v of chargeByPick.values()) sum += v;
    return sum;
  }, [chargeByPick]);

  // Customer-chosen size upgrades are charged on top of the fixed price (never
  // gifted). A merchant-pinned size is NOT charged - the fixed price covers it.
  const sizeExtras = useMemo(() => {
    let sum = 0;
    for (const u of units) {
      if (!u.itemId || !u.sizeId) continue;
      if (lockedSizeId(u.slotId, u.itemId)) continue;
      const size = items[u.itemId]?.sizes?.find((s) => s.id === u.sizeId);
      if (size) sum += size.priceDelta;
    }
    return sum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, items, slotChoices]);

  const incomplete = useMemo(() => {
    for (const u of units) {
      if (!u.itemId) return true;
      const item = items[u.itemId];
      if (!item) return true;
      for (const g of item.optionGroups) {
        const floor = g.required ? Math.max(1, g.minSelect) : g.minSelect;
        if (g.required && groupTotalUnits(g, u) < floor) return true;
      }
    }
    return units.length === 0;
  }, [units, items]);

  const total = (deal?.fixedPrice ?? 0) + extras + sizeExtras;

  function addToCart() {
    if (!deal || incomplete || added) return;
    const displayOptions: Array<{ groupId: string; optionId: string; name: string; groupName?: string; priceDelta: number }> = [];
    units.forEach((u, ui) => {
      const item = items[u.itemId!];
      displayOptions.push({
        groupId: u.slotId,
        optionId: item.id,
        name: item.name,
        groupName: u.label,
        priceDelta: 0,
      });
      const locked = !!lockedSizeId(u.slotId, item.id);
      const size = u.sizeId ? item.sizes?.find((s) => s.id === u.sizeId) : undefined;
      if (size && (item.sizes?.length ?? 0) > 1) {
        displayOptions.push({
          groupId: `${u.slotId}:size`,
          optionId: size.id,
          name: size.name,
          groupName: `${u.label} · גודל`,
          priceDelta: locked ? 0 : size.priceDelta,
        });
      }
      for (const g of item.optionGroups) {
        for (const o of g.options) {
          if (!u.optionIds.has(o.id)) continue;
          const q = unitOptionQty(g, u, o.id);
          displayOptions.push({
            groupId: g.id,
            optionId: o.id,
            name: q > 1 ? `${o.name} ×${q}` : o.name,
            groupName: `${u.label} · ${g.name}`,
            priceDelta: chargeByPick.get(`${ui}:${g.id}:${o.id}`) ?? 0,
          });
        }
      }
    });
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
        units: units.map((u) => {
          // Expand per-option quantity into repeated ids - the server counts
          // occurrences to price allowQty groups. Non-qty groups emit one id
          // each, identical to the previous Array.from(optionIds).
          const unitItem = items[u.itemId!];
          const optionIds: string[] = [];
          for (const g of unitItem.optionGroups) {
            for (const o of g.options) {
              const q = unitOptionQty(g, u, o.id);
              for (let k = 0; k < q; k++) optionIds.push(o.id);
            }
          }
          return { slotId: u.slotId, itemId: u.itemId!, sizeId: u.sizeId, optionIds };
        }),
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
          {(deal.freeExtras ?? 0) > 0 && (
            <div className="mx-5 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-(--qf-primary)/15 border border-(--qf-primary)/40 px-4 py-3 text-base font-bold text-qf-ink">
              {deal.freeExtras === 1
                ? "תוספת בתשלום אחת במתנה"
                : `${deal.freeExtras} תוספות בתשלום במתנה`}
              <span className="text-sm font-medium text-qf-mute">· ההנחה יורדת אוטומטית בסיכום</span>
            </div>
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

                  {chosen && lockedSizeId(u.slotId, chosen.id) && (() => {
                    const locked = chosen.sizes?.find(
                      (s) => s.id === lockedSizeId(u.slotId, chosen.id),
                    );
                    return locked ? (
                      <div className="rounded-xl bg-qf-line-soft/40 border border-qf-line px-3 py-2 text-xs text-qf-ink2">
                        גודל: <span className="font-semibold">{locked.name}</span>
                      </div>
                    ) : null;
                  })()}

                  {chosen && !lockedSizeId(u.slotId, chosen.id) && (chosen.sizes?.length ?? 0) > 1 && (
                    <div className="rounded-xl bg-qf-line-soft/40 border border-qf-line p-3 space-y-1.5">
                      <div className="text-xs font-semibold text-qf-ink2">גודל</div>
                      <div className="flex flex-wrap gap-1.5">
                        {chosen.sizes!.map((s) => {
                          const active = u.sizeId === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => pickSize(ui, s.id)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs border transition",
                                active
                                  ? "bg-(--qf-primary) text-white border-(--qf-primary)"
                                  : "bg-white text-qf-ink2 border-qf-line hover:border-qf-mute",
                              )}
                              aria-pressed={active}
                            >
                              {s.name}
                              {s.priceDelta > 0 && (
                                <span className={cn("ms-1 tnum", active ? "text-white/80" : "text-qf-mute")}>
                                  +₪{s.priceDelta}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {chosen &&
                    chosen.optionGroups.map((g) => {
                      const units = groupTotalUnits(g, u);
                      const floor = g.required ? Math.max(1, g.minSelect) : g.minSelect;
                      const missing = g.required && units < floor;
                      const atMax = g.type === "multi" && units >= g.maxSelect;
                      const qtyEnabled = !!g.allowQty && g.type === "multi" && g.maxSelect > 1;
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
                              {units}/{g.maxSelect}
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
                            // allowQty + selected → a compact −/qty/+ stepper,
                            // mirroring a normal item. Everything else keeps the
                            // original tap-to-toggle pill unchanged.
                            if (qtyEnabled && active) {
                              const q = unitOptionQty(g, u, o.id);
                              const cap = o.maxQuantity ?? 0;
                              const canInc = !atMax && (cap === 0 || q < cap);
                              return (
                                <div
                                  key={o.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-(--qf-primary) bg-(--qf-primary)/5 ps-2.5 pe-1 py-1 text-xs"
                                >
                                  <span className="font-medium text-qf-ink">{o.name}</span>
                                  {o.priceDelta > 0 && (
                                    <span className="tnum text-qf-mute">+₪{o.priceDelta}</span>
                                  )}
                                  <span className="inline-flex items-center gap-1 ms-0.5">
                                    <button
                                      type="button"
                                      aria-label="הפחתה"
                                      onClick={() => bumpOptionQty(ui, g, o.id, -1)}
                                      className="w-5 h-5 rounded-md grid place-items-center bg-white border border-qf-line text-qf-ink font-bold leading-none"
                                    >
                                      −
                                    </button>
                                    <span className="tnum w-4 text-center font-bold text-qf-ink">{q}</span>
                                    <button
                                      type="button"
                                      aria-label="הוספה"
                                      disabled={!canInc}
                                      onClick={() => bumpOptionQty(ui, g, o.id, 1)}
                                      className="w-5 h-5 rounded-md grid place-items-center bg-white border border-qf-line text-qf-ink font-bold leading-none disabled:opacity-40"
                                    >
                                      +
                                    </button>
                                  </span>
                                </div>
                              );
                            }
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
              {extras + sizeExtras > 0 && (
                <div className="text-[11px] text-qf-mute tnum">
                  {formatPrice(deal.fixedPrice)} + {formatPrice(extras + sizeExtras)} תוספות
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
