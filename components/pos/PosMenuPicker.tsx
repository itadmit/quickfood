"use client";

import { useMemo, useState } from "react";
import { usePosCart } from "@/components/pos/PosCartProvider";
import { formatPrice } from "@/lib/format";
import { resolveCategoryStyle } from "@/lib/category-style";
import { cn } from "@/lib/cn";
import { IcoSearch } from "@/components/shared/Icons";

export interface PosCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface PosItem {
  id: string;
  categoryId: string;
  name: string;
  basePrice: number;
  artType: string | null;
  imageUrl: string | null;
  defaultSize: { id: string; name: string; priceDelta: number; isDefault: boolean } | null;
  sizeCount: number;
  /** True when the item has any option groups (required or optional). The
   *  picker opens the config modal so the cashier can choose, instead of
   *  quick-adding with defaults that may fail order-create validation. */
  hasOptions: boolean;
  /** True when at least one option group is marked required. Used only
   *  for the small "+" badge on the tile. */
  hasRequiredOptions: boolean;
}

const ALL_KEY = "__all";

export function PosMenuPicker({
  categories,
  items,
  onConfigureItem,
}: {
  categories: PosCategory[];
  items: PosItem[];
  /** Called when the cashier taps an item that needs configuration
   *  (multiple sizes or any option groups). The register opens the config
   *  modal in response. */
  onConfigureItem: (itemId: string) => void;
}) {
  const { add } = usePosCart();
  const [activeCat, setActiveCat] = useState<string>(ALL_KEY);
  const [query, setQuery] = useState("");
  const [flashId, setFlashId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("he-IL");
    return items.filter((it) => {
      if (activeCat !== ALL_KEY && it.categoryId !== activeCat) return false;
      if (q && !it.name.toLocaleLowerCase("he-IL").includes(q)) return false;
      return true;
    });
  }, [items, activeCat, query]);

  function handleTap(it: PosItem) {
    // Items with options OR multiple sizes go through the config modal so
    // the cashier picks them explicitly. A drink with one price + no
    // options is a direct add — fastest path for the bulk of the menu.
    if (it.hasOptions || it.sizeCount > 1) {
      onConfigureItem(it.id);
      return;
    }
    const sizeDelta = it.defaultSize?.priceDelta ?? 0;
    add({
      itemId: it.id,
      name: it.name,
      basePrice: it.basePrice,
      artType: it.artType,
      imageUrl: it.imageUrl,
      quantity: 1,
      sizeId: it.defaultSize?.id ?? null,
      sizeName: it.defaultSize?.name ?? null,
      sizeDelta,
      options: [],
      notes: null,
      source: "menu",
    });
    setFlashId(it.id);
    window.setTimeout(() => setFlashId(null), 400);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Sticky top row: search + category chips */}
      <div className="sticky top-0 z-10 bg-qf-bg/95 backdrop-blur border-b-2 border-black/10">
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 border-2 border-black rounded-xl bg-white px-3 py-2 shadow-[0_2px_0_#000]">
            <IcoSearch s={14} c="#000" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש בתפריט..."
              className="flex-1 outline-none bg-transparent text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-xs text-qf-mute hover:text-qf-ink"
              >
                נקה
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
          <CategoryChip
            active={activeCat === ALL_KEY}
            onClick={() => setActiveCat(ALL_KEY)}
          >
            <span>הכל ({items.length})</span>
          </CategoryChip>
          {categories.map((c) => {
            const count = items.filter((i) => i.categoryId === c.id).length;
            if (count === 0) return null;
            const style = resolveCategoryStyle(c.icon, c.color);
            const Icon = style.Icon;
            return (
              <CategoryChip
                key={c.id}
                active={activeCat === c.id}
                onClick={() => setActiveCat(c.id)}
              >
                <span
                  className="w-5 h-5 rounded-full grid place-items-center shrink-0"
                  style={{ backgroundColor: style.bg }}
                >
                  <Icon size={11} color={style.fg} strokeWidth={2} />
                </span>
                <span>
                  {c.name} ({count})
                </span>
              </CategoryChip>
            );
          })}
        </div>
      </div>

      {/* Item grid */}
      {filtered.length === 0 ? (
        <div className="flex-1 grid place-items-center text-qf-mute text-sm">
          {items.length === 0
            ? "אין פריטים זמינים. הוסיפו פריטים בדאשבורד."
            : "אין פריטים בקטגוריה / לחיפוש זה."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 p-4">
          {filtered.map((it) => {
            const total = it.basePrice + (it.defaultSize?.priceDelta ?? 0);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => handleTap(it)}
                className={cn(
                  "aspect-square text-start rounded-2xl border-2 border-black bg-white shadow-[0_2px_0_#000] hover:bg-qf-bg active:translate-y-0.5 transition flex flex-col overflow-hidden",
                  flashId === it.id && "ring-4 ring-(--qf-primary)",
                )}
              >
                {it.imageUrl ? (
                  <div
                    className="flex-1 bg-qf-line-soft"
                    style={{
                      backgroundImage: `url(${it.imageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ) : (
                  <div className="flex-1 grid place-items-center bg-qf-line-soft text-3xl font-black text-qf-mute">
                    {it.name.charAt(0)}
                  </div>
                )}
                <div className="p-2 bg-white border-t-2 border-black/10">
                  <div className="text-xs font-bold leading-tight line-clamp-2">{it.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-black tnum">{formatPrice(total)}</span>
                    {it.hasRequiredOptions && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-qf-yolk-soft text-qf-ink"
                        title="לפריט יש תוספות חובה — מומלץ לערוך את השורה בכרטיסייה"
                      >
                        +
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full border-2 border-black text-sm font-bold transition",
        active
          ? "bg-black text-[#F8CB1E] shadow-[0_2px_0_#000]"
          : "bg-white text-black hover:bg-black/5",
      )}
    >
      {children}
    </button>
  );
}
