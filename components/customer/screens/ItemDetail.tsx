"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoChev, IcoMinus, IcoPlus, IcoHeart } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
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
}
interface OptionGroup {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
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
}: {
  tenantSlug: string;
  item: ItemData;
  businessType?: BusinessType;
}) {
  const router = useRouter();
  const { add } = useCart();

  const defaultSize = item.sizes.find((s) => s.isDefault) ?? item.sizes[0] ?? null;
  const [sizeId, setSizeId] = useState<string | null>(defaultSize?.id ?? null);

  const [picks, setPicks] = useState<Record<string, Set<string>>>(() => {
    const initial: Record<string, Set<string>> = {};
    for (const g of item.optionGroups) {
      initial[g.id] = new Set(g.options.filter((o) => o.isDefault).map((o) => o.id));
    }
    return initial;
  });

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const { total, sizeDelta, optionsDelta } = useMemo(() => {
    const size = item.sizes.find((s) => s.id === sizeId);
    const sDelta = size?.priceDelta ?? 0;
    let oDelta = 0;
    for (const g of item.optionGroups) {
      const selected = picks[g.id] ?? new Set();
      for (const o of g.options) {
        if (selected.has(o.id)) oDelta += o.priceDelta;
      }
    }
    const unit = item.basePrice + sDelta + oDelta;
    return { total: unit * quantity, sizeDelta: sDelta, optionsDelta: oDelta };
  }, [item, sizeId, picks, quantity]);

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

  function addToCart() {
    // Validate required groups
    for (const g of item.optionGroups) {
      const sel = picks[g.id] ?? new Set();
      if (g.required && sel.size < g.minSelect) {
        alert(`חובה לבחור באפשרות מתוך "${g.name}"`);
        return;
      }
    }
    const size = item.sizes.find((s) => s.id === sizeId);
    const selectedOpts: Array<{ groupId: string; optionId: string; name: string; priceDelta: number }> = [];
    for (const g of item.optionGroups) {
      const sel = picks[g.id] ?? new Set();
      for (const o of g.options) {
        if (sel.has(o.id)) {
          selectedOpts.push({ groupId: g.id, optionId: o.id, name: o.name, priceDelta: o.priceDelta });
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
    router.push(`/${tenantSlug}/cart`);
  }

  return (
    <div className="pb-32">
      {/* Hero */}
      <div className="relative h-80 overflow-hidden">
        <MenuItemImage
          src={item.images?.[0]}
          alt={item.name}
          businessType={businessType}
          size={420}
          rounded="md"
          className="w-full h-full"
        />
        <Link
          href={`/${tenantSlug}/menu`}
          className="absolute top-4 inset-s-4 w-10 h-10 rounded-full bg-white shadow grid place-items-center"
          aria-label="חזרה"
        >
          <IcoChev s={18} />
        </Link>
        <button
          type="button"
          className="absolute top-4 inset-e-4 w-10 h-10 rounded-full bg-white shadow grid place-items-center"
          aria-label="הוסף למועדפים"
        >
          <IcoHeart s={18} />
        </button>
      </div>

      <div className="px-5 -mt-5 relative">
        <div className="bg-white rounded-2xl border border-qf-line p-4 space-y-3">
          {item.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] bg-qf-green-soft text-qf-green-deep px-1.5 py-0.5 rounded-md"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-2xl font-bold">{item.name}</h1>
          <p className="text-sm text-qf-ink2 leading-relaxed">{item.description}</p>
          <div className="text-xs text-qf-mute tnum">
            מחיר בסיס {formatPrice(item.basePrice)}
            {sizeDelta !== 0 && ` · גודל ${sizeDelta > 0 ? "+" : ""}${sizeDelta}`}
            {optionsDelta !== 0 && ` · תוספות +${optionsDelta}`}
          </div>
        </div>
      </div>

      {/* Sizes */}
      {item.sizes.length > 0 && (
        <Section title="גודל">
          <div className="grid grid-cols-1 gap-2">
            {item.sizes.map((s) => (
              <Row
                key={s.id}
                active={sizeId === s.id}
                onClick={() => setSizeId(s.id)}
                label={s.name}
                hint={
                  s.priceDelta === 0
                    ? "בסיס"
                    : s.priceDelta > 0
                      ? `+${formatPrice(s.priceDelta)}`
                      : `-${formatPrice(-s.priceDelta)}`
                }
                radio
              />
            ))}
          </div>
        </Section>
      )}

      {/* Option groups */}
      {item.optionGroups.map((g) => (
        <Section
          key={g.id}
          title={g.name}
          hint={
            g.required
              ? "חובה"
              : g.type === "multi"
                ? `עד ${g.maxSelect}`
                : undefined
          }
        >
          <div className="grid grid-cols-1 gap-2">
            {g.options.map((o) => {
              const checked = picks[g.id]?.has(o.id) ?? false;
              return (
                <Row
                  key={o.id}
                  active={checked}
                  onClick={() => toggleOption(g, o.id)}
                  label={o.name}
                  hint={o.priceDelta > 0 ? `+${formatPrice(o.priceDelta)}` : undefined}
                  radio={g.type === "single"}
                />
              );
            })}
          </div>
        </Section>
      ))}

      {/* Notes */}
      <Section title="הערות לפיצרייה">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="למשל: בלי בצל, חתוך ל-8"
          className="w-full bg-white border border-qf-line rounded-xl px-3 py-2 text-sm outline-none focus:border-(--qf-primary)"
        />
      </Section>

      {/* Footer add to cart */}
      <div className="fixed bottom-0 inset-x-0 z-30 max-w-md mx-auto bg-white border-t border-qf-line p-4 flex items-center gap-3">
        <div className="flex items-center bg-qf-bg rounded-full border border-qf-line">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-9 h-9 grid place-items-center"
            aria-label="הפחת"
          >
            <IcoMinus s={16} />
          </button>
          <div className="w-7 text-center font-semibold tnum">{quantity}</div>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
            className="w-9 h-9 grid place-items-center"
            aria-label="הוסף"
          >
            <IcoPlus c="#11231a" s={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={addToCart}
          className="flex-1 bg-(--qf-primary) hover:bg-(--qf-deep) text-white rounded-full px-4 py-3 text-sm font-semibold flex items-center justify-between"
        >
          <span>הוסף לסל</span>
          <span className="tnum">{formatPrice(total)}</span>
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 mt-5">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-semibold">{title}</h2>
        {hint && <span className="text-xs text-qf-mute">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Row({
  active,
  onClick,
  label,
  hint,
  radio,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  radio?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-3 bg-white border rounded-xl px-3.5 py-3 text-sm transition",
        active
          ? "border-(--qf-primary) ring-1 ring-(--qf-primary)/30"
          : "border-qf-line hover:border-qf-ink2/30",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            radio ? "rounded-full" : "rounded-md",
            "w-5 h-5 border-2 grid place-items-center transition",
            active ? "border-(--qf-primary) bg-(--qf-primary)" : "border-qf-line-dash",
          )}
        >
          {active && (
            <span className={radio ? "w-2 h-2 rounded-full bg-white" : "text-white text-[10px]"}>
              {radio ? "" : "✓"}
            </span>
          )}
        </span>
        <span>{label}</span>
      </div>
      {hint && <span className="text-xs text-qf-mute tnum">{hint}</span>}
    </button>
  );
}
