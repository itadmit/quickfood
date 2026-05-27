"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoChev, IcoMinus, IcoPlus, IcoHeart, IcoCheck } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { formatOptionDisplayName } from "@/lib/format-option-name";
import { cn } from "@/lib/cn";

interface Size {
  id: string;
  code: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}
interface Option {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  imageUrl?: string | null;
}
type HalfPlacement = "left" | "right" | "full";

interface OptionGroup {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  includedFree?: number;
  helpText?: string | null;
  allowHalf?: boolean;
  options: Option[];
}
interface ItemData {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  artType: string | null;
  images?: string[];
  tags: string[];
  sizes: Size[];
  optionGroups: OptionGroup[];
}

export function ItemDetail({
  tenantSlug,
  item,
  businessType = "general",
  inModal = false,
  onClose,
}: {
  tenantSlug: string;
  item: ItemData;
  businessType?: BusinessType;
  inModal?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { add } = useCart();

  const defaultSize = item.sizes.find((s) => s.isDefault) ?? item.sizes[0] ?? null;
  const [sizeId, setSizeId] = useState<string | null>(defaultSize?.id ?? null);

  const [picks, setPicks] = useState<Record<string, Set<string>>>(() => {
    const initial: Record<string, Set<string>> = {};
    for (const g of item.optionGroups) {
      if (!g.allowHalf) {
        initial[g.id] = new Set(g.options.filter((o) => o.isDefault).map((o) => o.id));
      }
    }
    return initial;
  });

  // For allowHalf groups: maps optionId → placement ("left"|"right"|"full")
  const [halfPicks, setHalfPicks] = useState<Record<string, Record<string, HalfPlacement>>>(() => {
    const initial: Record<string, Record<string, HalfPlacement>> = {};
    for (const g of item.optionGroups) {
      if (g.allowHalf) initial[g.id] = {};
    }
    return initial;
  });

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [flashGroupId, setFlashGroupId] = useState<string | null>(null);
  const [addPhase, setAddPhase] = useState<"idle" | "loading" | "done">("idle");

  // Sticky top bar appears when the hero scrolls out of view
  const heroSentinelRef = useRef<HTMLDivElement | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  useEffect(() => {
    const target = heroSentinelRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const total = useMemo(() => {
    const size = item.sizes.find((s) => s.id === sizeId);
    const sDelta = size?.priceDelta ?? 0;
    let oDelta = 0;
    for (const g of item.optionGroups) {
      if (g.allowHalf) {
        const gHalf = halfPicks[g.id] ?? {};
        for (const o of g.options) {
          const placement = gHalf[o.id];
          if (!placement) continue;
          const delta = placement !== "full" ? Math.round(o.priceDelta / 2) : o.priceDelta;
          oDelta += delta;
        }
      } else {
        const selected = picks[g.id] ?? new Set();
        const paidSelections = g.options
          .filter((o) => selected.has(o.id) && o.priceDelta > 0)
          .sort((a, b) => a.priceDelta - b.priceDelta);
        const free = g.includedFree ?? 0;
        for (let i = 0; i < paidSelections.length; i++) {
          if (i >= free) oDelta += paidSelections[i].priceDelta;
        }
        for (const o of g.options) {
          if (selected.has(o.id) && o.priceDelta < 0) oDelta += o.priceDelta;
        }
      }
    }
    return (item.basePrice + sDelta + oDelta) * quantity;
  }, [item, sizeId, picks, halfPicks, quantity]);

  const missingGroup = useMemo(() => {
    for (const g of item.optionGroups) {
      if (g.allowHalf) {
        const count = Object.keys(halfPicks[g.id] ?? {}).length;
        if (g.required && count < g.minSelect) return g;
      } else {
        const sel = picks[g.id] ?? new Set();
        if (g.required && sel.size < g.minSelect) return g;
      }
    }
    return null;
  }, [item.optionGroups, picks, halfPicks]);

  function toggleOption(group: OptionGroup, optionId: string) {
    setPicks((prev) => {
      const next = { ...prev };
      const current = new Set(next[group.id] ?? []);
      if (group.type === "single") {
        next[group.id] = new Set([optionId]);
      } else {
        if (current.has(optionId)) {
          current.delete(optionId);
        } else {
          if (current.size >= group.maxSelect) return prev;
          current.add(optionId);
        }
        next[group.id] = current;
      }
      return next;
    });
  }

  function toggleHalf(group: OptionGroup, optionId: string, placement: HalfPlacement) {
    setHalfPicks((prev) => {
      const gMap = { ...(prev[group.id] ?? {}) };
      const count = Object.keys(gMap).length;
      if (gMap[optionId] === placement) {
        // tap same button → deselect
        delete gMap[optionId];
      } else if (!gMap[optionId] && count >= group.maxSelect) {
        // at max, can't add more
        return prev;
      } else {
        gMap[optionId] = placement;
      }
      return { ...prev, [group.id]: gMap };
    });
  }

  function addToCart() {
    if (missingGroup) {
      const el = document.getElementById(`group-${missingGroup.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashGroupId(missingGroup.id);
      window.setTimeout(() => setFlashGroupId(null), 1400);
      return;
    }
    const size = item.sizes.find((s) => s.id === sizeId);
    const selectedOpts: Array<{ groupId: string; optionId: string; name: string; priceDelta: number; half?: HalfPlacement }> = [];
    for (const g of item.optionGroups) {
      if (g.allowHalf) {
        const gHalf = halfPicks[g.id] ?? {};
        for (const o of g.options) {
          const placement = gHalf[o.id];
          if (!placement) continue;
          const effectiveDelta = placement !== "full" ? Math.round(o.priceDelta / 2) : o.priceDelta;
          selectedOpts.push({ groupId: g.id, optionId: o.id, name: formatOptionDisplayName(g.name, o.name), priceDelta: effectiveDelta, half: placement });
        }
      } else {
        const sel = picks[g.id] ?? new Set();
        for (const o of g.options) {
          if (sel.has(o.id)) {
            selectedOpts.push({ groupId: g.id, optionId: o.id, name: formatOptionDisplayName(g.name, o.name), priceDelta: o.priceDelta });
          }
        }
      }
    }
    add({
      itemId: item.id,
      name: item.name,
      basePrice: item.basePrice,
      artType: item.artType,
      imageUrl: item.images?.[0] ?? null,
      quantity,
      sizeId: size?.id ?? null,
      sizeName: size?.name ?? null,
      sizeDelta: size?.priceDelta ?? 0,
      options: selectedOpts,
      notes: notes || null,
    });
    setAddPhase("loading");
    window.setTimeout(() => setAddPhase("done"), 380);
    if (inModal) {
      window.setTimeout(() => onClose?.(), 780);
    } else {
      window.setTimeout(() => {
        window.scrollTo(0, 0);
        router.push(`/s/${tenantSlug}/cart`);
      }, 780);
    }
  }

  const ctaLabel = missingGroup ? `בחר ${missingGroup.name}` : "הוסף לסל";

  return (
    <div
      className={cn(
        "pb-36",
        inModal ? "lg:pb-0" : "lg:pb-12",
        // Card chrome only on the full-page route; inside the modal
        // the wrapper provides its own card surface.
        !inModal &&
          "lg:max-w-4xl lg:mx-auto lg:mt-8 lg:bg-white lg:rounded-3xl lg:shadow-xl lg:overflow-hidden",
      )}
    >
      {/* Sticky top bar — mobile only on the full page. Inside the
          modal the close button (top-right of the modal chrome)
          handles "go back". */}
      {!inModal && (
        <div
          className={cn(
            "lg:hidden fixed top-0 inset-x-0 z-40 max-w-md mx-auto bg-white/95 backdrop-blur border-b border-qf-line transition-all duration-200",
            showStickyBar
              ? "translate-y-0 opacity-100"
              : "-translate-y-full opacity-0 pointer-events-none",
          )}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <Link
              href={`/s/${tenantSlug}`}
              className="w-9 h-9 rounded-full bg-qf-line-soft grid place-items-center"
              aria-label="חזרה"
            >
              <IcoChev s={16} />
            </Link>
            <div className="flex-1 min-w-0 font-semibold truncate">
              {item.name}
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative">
        <div
          className={cn(
            "relative overflow-hidden bg-qf-line-soft",
            inModal
              ? "h-64 sm:h-80 lg:h-105"
              : "h-72 lg:h-96 rounded-b-3xl lg:rounded-none",
          )}
        >
          <MenuItemImage
            src={item.images?.[0]}
            alt={item.name}
            businessType={businessType}
            size={520}
            rounded="none"
            fill
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/30 to-transparent pointer-events-none" />
        </div>
        {!inModal && (
          <Link
            href={`/s/${tenantSlug}`}
            className="lg:hidden absolute top-4 inset-s-4 w-10 h-10 rounded-full bg-white/95 backdrop-blur shadow-md grid place-items-center"
            aria-label="חזרה"
          >
            <IcoChev s={18} />
          </Link>
        )}
        <button
          type="button"
          className="absolute top-4 inset-e-4 w-10 h-10 rounded-full bg-white/95 backdrop-blur shadow-md grid place-items-center"
          aria-label="הוסף למועדפים"
        >
          <IcoHeart s={18} />
        </button>
        {/* Sentinel for sticky-bar toggle */}
        <div ref={heroSentinelRef} className="absolute bottom-12 inset-x-0 h-px" />
      </div>

      {/* Title + description */}
      <section className="bg-white px-5 pt-5 pb-5">
        {item.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {item.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="text-[10px] bg-qf-green-soft text-qf-green-deep px-2 py-0.5 rounded-md font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-[22px] font-bold leading-tight">{item.name}</h1>
        {item.description && (
          <p className="text-sm text-qf-ink2 leading-relaxed mt-2">{item.description}</p>
        )}
        <div className="text-base font-semibold tnum mt-3">{formatPrice(item.basePrice)}</div>
      </section>

      {/* Sizes (treated as required-single group) */}
      {item.sizes.length > 0 && (
        <Section title="גודל" required={item.sizes.length > 1}>
          {item.sizes.map((s) => (
            <Row
              key={s.id}
              active={sizeId === s.id}
              onClick={() => setSizeId(s.id)}
              label={s.name}
              priceLabel={formatPrice(item.basePrice + s.priceDelta)}
              priceTone="absolute"
              radio
            />
          ))}
        </Section>
      )}

      {/* Option groups */}
      {item.optionGroups.map((g) => {
        if (g.allowHalf) {
          const gHalf = halfPicks[g.id] ?? {};
          const selected = Object.keys(gHalf).length;
          const atMax = selected >= g.maxSelect;
          const subtitle = g.required
            ? selected >= g.minSelect
              ? `הושלם · ${selected}/${g.maxSelect}`
              : `חובה ${g.minSelect}–${g.maxSelect} · ${selected}/${g.maxSelect}`
            : atMax
              ? `הגעת למקסימום · ${g.maxSelect}/${g.maxSelect}`
              : `אפשר לבחור עד ${g.maxSelect} · כל תוספת ניתן לקבוע לחצי פיצה`;

          return (
            <Section
              key={g.id}
              id={`group-${g.id}`}
              title={g.name}
              required={g.required}
              subtitle={subtitle}
              counter={g.maxSelect > 1 ? { selected, max: g.maxSelect, atMax } : undefined}
              helpText={g.helpText}
              flash={flashGroupId === g.id}
            >
              {g.options.map((o) => {
                const placement = gHalf[o.id] as HalfPlacement | undefined;
                const blocked = !placement && atMax;
                const halfPrice = Math.round(o.priceDelta / 2);
                return (
                  <div key={o.id} className={cn("flex items-center gap-2 px-4 py-3 border-b border-qf-line last:border-0", blocked && "opacity-40")}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{o.name}</div>
                      {o.priceDelta > 0 && (
                        <div className="text-xs text-qf-ink2 mt-0.5">
                          {`שלם +${formatPrice(o.priceDelta)} · חצי +${formatPrice(halfPrice)}`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(["left", "full", "right"] as HalfPlacement[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          disabled={blocked && placement !== p}
                          onClick={() => { if (!blocked || placement) toggleHalf(g, o.id, p); }}
                          className={cn(
                            "h-8 px-2.5 rounded-lg text-xs font-semibold border transition",
                            placement === p
                              ? "bg-(--qf-primary) border-(--qf-primary) text-white"
                              : "bg-white border-qf-line text-qf-ink2 hover:border-(--qf-primary) hover:text-(--qf-primary)",
                          )}
                        >
                          {p === "left" ? "חצי א׳" : p === "right" ? "חצי ב׳" : "שלם"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </Section>
          );
        }

        const free = g.includedFree ?? 0;
        const selected = picks[g.id]?.size ?? 0;
        const remaining = Math.max(0, g.maxSelect - selected);
        const atMax = selected >= g.maxSelect;
        const freeRemaining = Math.max(0, free - selected);

        let subtitle: string;
        if (g.required) {
          if (g.type === "single") {
            subtitle = selected > 0 ? "נבחר" : "חובה לבחור 1";
          } else {
            const range = g.minSelect === g.maxSelect ? `${g.minSelect}` : `${g.minSelect}–${g.maxSelect}`;
            subtitle = selected >= g.minSelect
              ? `הושלם · ${selected}/${g.maxSelect}`
              : `חובה ${range} · ${selected}/${g.maxSelect}`;
          }
        } else if (g.type === "multi") {
          if (atMax) {
            subtitle = `הגעת למקסימום · ${g.maxSelect}/${g.maxSelect}`;
          } else if (selected > 0) {
            subtitle = freeRemaining > 0
              ? `אפשר לבחור עוד ${remaining} · ${freeRemaining} חינם נותרו`
              : `אפשר לבחור עוד ${remaining}`;
          } else {
            subtitle = free > 0
              ? `${free} הראשונים חינם · אפשר לבחור עד ${g.maxSelect}`
              : `אפשר לבחור עד ${g.maxSelect}`;
          }
        } else {
          subtitle = selected > 0 ? "נבחר" : "אופציונלי";
        }

        return (
          <Section
            key={g.id}
            id={`group-${g.id}`}
            title={g.name}
            required={g.required}
            subtitle={subtitle}
            counter={
              g.type === "multi" && g.maxSelect > 1
                ? { selected, max: g.maxSelect, atMax }
                : undefined
            }
            helpText={g.helpText}
            flash={flashGroupId === g.id}
          >
            {g.options.map((o) => {
              const checked = picks[g.id]?.has(o.id) ?? false;
              const blocked = !checked && atMax;
              return (
                <Row
                  key={o.id}
                  active={checked}
                  disabled={blocked}
                  onClick={() => {
                    if (blocked) return;
                    toggleOption(g, o.id);
                  }}
                  label={o.name}
                  imageUrl={o.imageUrl}
                  priceLabel={
                    o.priceDelta === 0
                      ? null
                      : o.priceDelta > 0
                        ? `+${formatPrice(o.priceDelta)}`
                        : `-${formatPrice(-o.priceDelta)}`
                  }
                  priceTone="delta"
                  radio={g.type === "single"}
                />
              );
            })}
          </Section>
        );
      })}

      {/* Notes */}
      <Section title="הערות לפיצרייה" subtitle="אופציונלי">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="למשל: בלי בצל, חתוך ל-8"
          className="w-full bg-qf-bg border border-qf-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-(--qf-primary) focus:bg-white resize-none"
        />
      </Section>

      {/* Footer CTA — Wolt-style chunky pill with quantity stepper on one side
          and bold add-to-cart CTA on the other. Sticks to viewport on mobile,
          sits naturally at the bottom of the card on desktop. */}
      <div className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto lg:static lg:inset-auto lg:max-w-none lg:mx-0 lg:z-auto">
        <div className="bg-white border-t border-qf-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3 lg:pb-4 lg:px-5">
          <div className="flex items-center bg-qf-line-soft rounded-full">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-12 h-14 grid place-items-center disabled:opacity-40 active:bg-qf-line-dash rounded-full transition"
              aria-label="הפחת"
            >
              <IcoMinus s={18} />
            </button>
            <div className="w-8 text-center font-bold tnum text-base">{quantity}</div>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              disabled={quantity >= 20}
              className="w-12 h-14 grid place-items-center disabled:opacity-40 active:bg-qf-line-dash rounded-full transition"
              aria-label="הוסף"
            >
              <IcoPlus c="#11231a" s={18} />
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={addPhase !== "idle"}
            className={cn(
              "flex-1 rounded-2xl px-5 h-14 text-base font-bold flex items-center justify-between transition-all duration-300 active:scale-[0.98]",
              addPhase !== "idle"
                ? "bg-qf-green-deep text-white shadow-lg shadow-qf-green-deep/30"
                : missingGroup
                  ? "bg-qf-ink2 text-white"
                  : "bg-(--qf-primary) hover:bg-(--qf-deep) text-white shadow-lg shadow-(--qf-primary)/25",
            )}
          >
            {addPhase === "idle" ? (
              <>
                <span>{ctaLabel}</span>
                <span className="tnum">{formatPrice(total)}</span>
              </>
            ) : addPhase === "loading" ? (
              <>
                <span>מוסיף לסל</span>
                <span className="qf-spinner" style={{ width: 20, height: 20, borderWidth: 2.5 }} />
              </>
            ) : (
              <>
                <span>נוסף לסל</span>
                <IcoCheck c="#fff" s={20} className="animate-qf-check-in" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  required,
  counter,
  helpText,
  flash,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  required?: boolean;
  counter?: { selected: number; max: number; atMax: boolean };
  helpText?: string | null;
  flash?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "bg-white mt-2 px-5 py-4 scroll-mt-20 transition",
        flash && "ring-2 ring-qf-tomato/60",
      )}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-semibold text-base">{title}</h2>
          {required && (
            <span className="text-[10px] bg-qf-tomato-soft text-qf-tomato px-1.5 py-0.5 rounded-md font-semibold">
              חובה
            </span>
          )}
          {counter && (
            <span
              className={cn(
                "text-[11px] tnum px-1.5 py-0.5 rounded-md font-bold",
                counter.atMax
                  ? "bg-qf-ink text-white"
                  : counter.selected > 0
                    ? "bg-(--qf-soft) text-(--qf-deep)"
                    : "bg-qf-line-soft text-qf-mute",
              )}
            >
              {counter.selected}/{counter.max}
            </span>
          )}
        </div>
        {subtitle && (
          <span
            className={cn(
              "text-xs",
              counter?.atMax ? "text-qf-tomato font-semibold" : "text-qf-mute",
            )}
          >
            {subtitle}
          </span>
        )}
      </div>
      {helpText && (
        <p className="text-xs text-qf-mute mb-2 leading-snug">{helpText}</p>
      )}
      <div>{children}</div>
    </section>
  );
}

function Row({
  active,
  onClick,
  label,
  priceLabel,
  priceTone,
  radio,
  imageUrl,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  priceLabel: string | null;
  priceTone: "absolute" | "delta";
  radio?: boolean;
  imageUrl?: string | null;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={cn(
        "w-full flex items-center justify-between gap-3 py-3 text-sm border-b border-qf-line last:border-0 transition",
        disabled ? "opacity-40 cursor-not-allowed" : "active:bg-qf-line-soft",
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            radio ? "rounded-full" : "rounded-md",
            "w-5 h-5 border-2 grid place-items-center shrink-0 transition",
            active ? "border-(--qf-primary) bg-(--qf-primary)" : "border-qf-line-dash",
          )}
        >
          {active &&
            (radio ? (
              <span className="w-2 h-2 rounded-full bg-white" />
            ) : (
              <IcoCheck c="#fff" s={12} />
            ))}
        </span>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="w-9 h-9 rounded-lg object-cover shrink-0 border border-qf-line"
            loading="lazy"
          />
        )}
        <span className={cn("truncate", active ? "font-medium text-qf-ink" : "text-qf-ink")}>
          {label}
        </span>
      </div>
      {priceLabel && (
        <span
          className={cn(
            "text-xs tnum font-medium shrink-0",
            priceTone === "absolute" ? "text-qf-ink2" : "text-qf-mute",
          )}
        >
          {priceLabel}
        </span>
      )}
    </button>
  );
}
