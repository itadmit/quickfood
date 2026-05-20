"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { IcoPizza } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

interface Category {
  id: string;
  name: string;
}
interface Item {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number;
  prepMinutes: number;
  available: boolean;
  artType: string | null;
  sku: string | null;
}

export function MenuList({
  categories,
  items,
  visibleCount,
  hiddenCount,
}: {
  categories: Category[];
  items: Item[];
  visibleCount: number;
  hiddenCount: number;
}) {
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [localItems, setLocalItems] = useState(items);

  const filtered = useMemo(
    () => (activeCat === "all" ? localItems : localItems.filter((i) => i.categoryId === activeCat)),
    [activeCat, localItems],
  );

  async function toggleAvailability(itemId: string, next: boolean) {
    // optimistic
    setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, available: next } : i)));
    const res = await fetch(`/api/v1/merchant/menu/items/${itemId}/availability`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ available: next }),
    });
    if (!res.ok) {
      setLocalItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, available: !next } : i)));
    }
  }

  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">תפריט</h1>
          <p className="text-sm text-qf-mute">
            {visibleCount} פריטים זמינים · {hiddenCount} מוסתרים
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-3.5 py-2 rounded-xl border border-qf-line-dash hover:bg-qf-line-soft text-sm">
            ייבוא מ-CSV
          </button>
          <Link
            href="/dashboard/menu/new"
            className="px-3.5 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm"
          >
            + פריט חדש
          </Link>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <CategoryChip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
          הכל ({localItems.length})
        </CategoryChip>
        {categories.map((c) => {
          const count = localItems.filter((i) => i.categoryId === c.id).length;
          return (
            <CategoryChip
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
            >
              {c.name} ({count})
            </CategoryChip>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-qf-line-dash overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_140px_100px_120px_100px_60px] gap-3 px-4 py-2.5 text-xs font-medium text-qf-mute border-b border-qf-line-dash bg-qf-line-soft/60">
          <div></div>
          <div>שם / SKU</div>
          <div>קטגוריה</div>
          <div>מחיר</div>
          <div>זמן הכנה</div>
          <div>זמינות</div>
          <div></div>
        </div>
        {filtered.map((item) => (
          <div
            key={item.id}
            className={cn(
              "grid grid-cols-[60px_1fr_140px_100px_120px_100px_60px] gap-3 px-4 py-3 items-center border-b border-qf-line-soft last:border-b-0 hover:bg-qf-line-soft/40",
              !item.available && "opacity-55",
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-qf-warm-dash grid place-items-center">
              <IcoPizza c="#c2421f" s={20} />
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate">{item.name}</div>
              {item.sku && <div className="text-xs text-qf-mute" dir="ltr">{item.sku}</div>}
            </div>
            <div className="text-sm text-qf-ink2 truncate">{catMap[item.categoryId]}</div>
            <div className="text-sm tnum font-medium">{formatPrice(item.basePrice)}</div>
            <div className="text-sm text-qf-ink2 tnum">{item.prepMinutes} דק&apos;</div>
            <div>
              <button
                type="button"
                role="switch"
                aria-checked={item.available}
                onClick={() => toggleAvailability(item.id, !item.available)}
                className={cn(
                  "relative inline-flex h-6 w-10 rounded-full transition",
                  item.available ? "bg-(--qf-primary)" : "bg-qf-line-dash",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition",
                    item.available ? "inset-e-0.5" : "inset-s-0.5",
                  )}
                />
              </button>
            </div>
            <Link
              href={`/dashboard/menu/${item.id}`}
              aria-label="ערוך פריט"
              className="w-8 h-8 rounded-lg hover:bg-qf-line-soft grid place-items-center text-qf-mute"
            >
              ⋯
            </Link>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-qf-mute">
            אין פריטים בקטגוריה הזו
          </div>
        )}
      </div>
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
        "px-3.5 py-1.5 rounded-full border whitespace-nowrap text-sm transition",
        active
          ? "bg-(--qf-primary) text-white border-transparent"
          : "bg-white border-qf-line-dash text-qf-ink2 hover:border-(--qf-primary)",
      )}
    >
      {children}
    </button>
  );
}
