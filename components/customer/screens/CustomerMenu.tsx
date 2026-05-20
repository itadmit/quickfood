"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IcoChev, IcoSearch, IcoStar } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
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
  images?: string[];
  tags: string[];
}

interface Props {
  tenantSlug: string;
  tenantName: string;
  businessType?: BusinessType;
  categories: Array<{ id: string; name: string }>;
  items: Item[];
}

// px offset between viewport top and the line below the sticky chip bar
const SCROLL_OFFSET = 80;

export function CustomerMenu({ tenantSlug, tenantName, businessType = "general", categories, items }: Props) {
  const [query, setQuery] = useState("");
  const { itemCount, subtotal } = useCart();

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    );
  }, [items, query]);

  const byCategory = useMemo(() => {
    const groups: Record<string, Item[]> = {};
    for (const it of filtered) {
      (groups[it.categoryId] ||= []).push(it);
    }
    return groups;
  }, [filtered]);

  const visibleCategories = useMemo(
    () => categories.filter((c) => (byCategory[c.id]?.length ?? 0) > 0),
    [categories, byCategory],
  );

  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? "");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollLockRef = useRef(false);

  // Scroll-spy: highlight the section currently sitting just below the sticky chip bar.
  useEffect(() => {
    if (visibleCategories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollLockRef.current) return;
        const intersecting = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (intersecting.length > 0) {
          const id = (intersecting[0].target as HTMLElement).dataset.catId;
          if (id) setActiveCat(id);
        }
      },
      {
        // Treat a band just under the chip bar as the "active" zone.
        rootMargin: `-${SCROLL_OFFSET + 20}px 0px -65% 0px`,
        threshold: 0,
      },
    );
    for (const c of visibleCategories) {
      const el = sectionRefs.current[c.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [visibleCategories]);

  // Keep the active chip horizontally in view inside the sticky pill bar.
  useEffect(() => {
    const el = chipRefs.current[activeCat];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCat]);

  const handleChipClick = (catId: string) => {
    setActiveCat(catId);
    const el = sectionRefs.current[catId];
    if (!el) return;
    scrollLockRef.current = true;
    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET;
    window.scrollTo({ top, behavior: "smooth" });
    window.setTimeout(() => {
      scrollLockRef.current = false;
    }, 700);
  };

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
          {visibleCategories.map((c) => {
            const active = activeCat === c.id;
            return (
              <button
                key={c.id}
                ref={(el) => {
                  chipRefs.current[c.id] = el;
                }}
                type="button"
                onClick={() => handleChipClick(c.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-sm whitespace-nowrap border transition",
                  active
                    ? "bg-(--qf-primary) text-white border-transparent"
                    : "bg-white text-qf-ink2 border-qf-line",
                )}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 mt-3 space-y-6">
        {visibleCategories.map((c) => {
          const list = byCategory[c.id] ?? [];
          return (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              ref={(el) => {
                sectionRefs.current[c.id] = el;
              }}
              data-cat-id={c.id}
              className="space-y-2.5 scroll-mt-20"
            >
              <h2 className="font-semibold text-base">{c.name}</h2>
              <div className="space-y-2.5">
                {list.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${tenantSlug}/menu/${item.id}`}
                    className="block bg-white rounded-2xl border border-qf-line p-3 flex gap-3"
                  >
                    <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0">
                      <MenuItemImage
                        src={item.images?.[0]}
                        alt={item.name}
                        businessType={businessType}
                        size={96}
                        rounded="xl"
                        className="w-full h-full"
                      />
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
