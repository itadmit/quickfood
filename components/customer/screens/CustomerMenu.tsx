"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { IcoChev, IcoSearch, IcoStar } from "@/components/shared/Icons";
import { PizzaArt } from "@/components/customer/PizzaArt";
import { BottomTabBar } from "@/components/customer/BottomTabBar";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: number;
  artType: string | null;
  tags: string[];
}

interface Props {
  tenantSlug: string;
  tenantName: string;
  categories: Array<{ id: string; name: string }>;
  items: Item[];
}

export function CustomerMenu({ tenantSlug, tenantName, categories, items }: Props) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const { itemCount, subtotal } = useCart();

  const filtered = useMemo(() => {
    let res = items;
    if (activeCat !== "all") res = res.filter((i) => i.categoryId === activeCat);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      res = res.filter(
        (i) =>
          i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
      );
    }
    return res;
  }, [items, activeCat, query]);

  const byCategory = useMemo(() => {
    const groups: Record<string, Item[]> = {};
    for (const it of filtered) {
      (groups[it.categoryId] ||= []).push(it);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="pb-32">
      <header className="bg-gradient-to-b from-(--qf-primary) to-(--qf-deep) text-white px-5 pt-5 pb-7">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href={`/${tenantSlug}`}
            className="w-9 h-9 rounded-full bg-white/15 grid place-items-center"
            aria-label="חזרה"
          >
            <IcoChev c="#fff" s={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg truncate">{tenantName}</h1>
            <div className="text-xs opacity-85 flex items-center gap-1.5">
              <IcoStar c="#fff" s={10} fill="#fff" />
              <span className="tnum">4.8</span>
              <span>· 1,247 ביקורות</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-full flex items-center gap-2 px-4 py-2.5">
          <IcoSearch c="#7c8a82" s={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש בתפריט"
            className="flex-1 bg-transparent outline-none text-sm text-qf-ink placeholder:text-qf-mute"
          />
        </div>
      </header>

      {/* Sticky category nav */}
      <div className="sticky top-0 z-20 bg-qf-bg/95 backdrop-blur border-b border-qf-line">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 py-2.5">
          <Chip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
            הכל
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="px-5 mt-3 space-y-6">
        {categories.map((c) => {
          const list = byCategory[c.id] ?? [];
          if (list.length === 0) return null;
          return (
            <section key={c.id} id={`cat-${c.id}`} className="space-y-2.5">
              <h2 className="font-semibold text-base">{c.name}</h2>
              <div className="space-y-2.5">
                {list.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${tenantSlug}/menu/${item.id}`}
                    className="block bg-white rounded-2xl border border-qf-line p-3 flex gap-3"
                  >
                    <div className="w-24 h-24 rounded-xl bg-qf-warm grid place-items-center shrink-0">
                      <PizzaArt size={88} type={item.artType ?? "margherita"} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="font-medium leading-tight">{item.name}</div>
                        <div className="text-xs text-qf-mute line-clamp-2 mt-0.5">
                          {item.description}
                        </div>
                        {item.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {item.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="text-[10px] bg-qf-green-soft text-qf-green-deep px-1.5 py-0.5 rounded-md"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="font-semibold tnum">{formatPrice(item.basePrice)}</div>
                        <div className="w-8 h-8 rounded-full bg-(--qf-primary) text-white grid place-items-center text-lg leading-none">
                          +
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-sm text-qf-mute py-10">
            לא נמצאו פריטים תואמים
          </div>
        )}
      </div>

      {/* Floating cart bar */}
      {itemCount > 0 && (
        <Link
          href={`/${tenantSlug}/cart`}
          className="fixed bottom-20 inset-x-0 z-30 max-w-md mx-auto px-4"
        >
          <div className="bg-(--qf-primary) text-white rounded-2xl shadow-lg flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="bg-white/20 rounded-full w-7 h-7 grid place-items-center text-sm font-bold tnum">
                {itemCount}
              </span>
              <span className="font-medium">הצג סל</span>
            </div>
            <div className="font-semibold tnum">{formatPrice(subtotal)}</div>
          </div>
        </Link>
      )}

      <BottomTabBar tenantSlug={tenantSlug} />
    </div>
  );
}

function Chip({
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
        "px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap border transition",
        active
          ? "bg-(--qf-primary) text-white border-transparent"
          : "bg-white text-qf-ink2 border-qf-line",
      )}
    >
      {children}
    </button>
  );
}
