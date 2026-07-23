"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { resolveCategoryStyle, type CategoryColorKey } from "@/lib/category-style";
import { IcoSearch, IcoArrowLeft } from "@/components/shared/Icons";
import { Check, Plus } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/components/customer/CartProvider";
import { NoticeCard, type MenuListItem, type NoticeRow } from "@/components/customer/MenuList";
import { cn } from "@/lib/cn";

interface CategoryRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  imageUrl?: string | null;
}

interface Props {
  tenantSlug: string;
  businessType?: BusinessType;
  categories: CategoryRow[];
  items: MenuListItem[];
  noticesByCategory?: Map<string, NoticeRow[]>;
  noticesByItem?: Map<string, NoticeRow[]>;
  featuredBadgeLabel?: string | null;
  themeDefaultColor?: CategoryColorKey;
  /** Opens the shared item-detail modal (handled by CustomerHome). */
  onItemOpen?: () => void;
}

export function CategoryGridBrowser({
  businessType = "general",
  categories,
  items,
  noticesByCategory,
  noticesByItem,
  featuredBadgeLabel,
  themeDefaultColor,
  onItemOpen,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCat = searchParams.get("cat");
  const [query, setQuery] = useState("");

  const byCategory = useMemo(() => {
    const groups: Record<string, MenuListItem[]> = {};
    for (const it of items) (groups[it.categoryId] ||= []).push(it);
    return groups;
  }, [items]);

  // Only categories that actually have visible items become cubes.
  const visibleCategories = useMemo(
    () => categories.filter((c) => (byCategory[c.id]?.length ?? 0) > 0),
    [categories, byCategory],
  );

  const q = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!q) return [];
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    );
  }, [items, q]);

  const goToCategory = useCallback(
    (catId: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("cat", catId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [router, pathname, searchParams],
  );

  const goToGrid = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("cat");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  // Build a URL that opens the item modal while preserving the current
  // category so closing the modal returns to the same category view.
  const itemHref = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("item", id);
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams],
  );

  const current = activeCat
    ? visibleCategories.find((c) => c.id === activeCat) ?? null
    : null;

  return (
    <div className="px-5 mt-5 lg:max-w-7xl lg:mx-auto lg:px-6 lg:mt-8 pb-4">
      <div className="mb-4 lg:mb-5">
        <div className="bg-white rounded-full flex items-center gap-2.5 px-5 h-11 border border-qf-line focus-within:ring-2 focus-within:ring-(--qf-primary)">
          <IcoSearch c="#7c8a82" s={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש בחנות"
            className="flex-1 bg-transparent outline-none border-0 appearance-none text-[15px] text-qf-ink placeholder:text-qf-mute [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-qf-mute hover:text-qf-ink shrink-0"
              aria-label="נקה חיפוש"
            >
              נקה
            </button>
          )}
        </div>
      </div>

      {q ? (
        <SearchResults
          items={searchResults}
          businessType={businessType}
          featuredBadgeLabel={featuredBadgeLabel}
          noticesByItem={noticesByItem}
          itemHref={itemHref}
          onItemOpen={onItemOpen}
        />
      ) : current ? (
        <CategoryDetail
          category={current}
          categories={visibleCategories}
          items={byCategory[current.id] ?? []}
          businessType={businessType}
          featuredBadgeLabel={featuredBadgeLabel}
          noticesByCategory={noticesByCategory}
          noticesByItem={noticesByItem}
          itemHref={itemHref}
          onItemOpen={onItemOpen}
          onSelectCategory={goToCategory}
          onBack={goToGrid}
        />
      ) : (
        <CategoryCubes
          categories={visibleCategories}
          countFor={(id) => byCategory[id]?.length ?? 0}
          themeDefaultColor={themeDefaultColor}
          onSelect={goToCategory}
        />
      )}
    </div>
  );
}

function CategoryCubes({
  categories,
  countFor,
  themeDefaultColor,
  onSelect,
}: {
  categories: CategoryRow[];
  countFor: (id: string) => number;
  themeDefaultColor?: CategoryColorKey;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <h2 className="text-lg lg:text-2xl font-bold mb-3 lg:mb-4">הקטגוריות שלנו</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
        {categories.map((c) => {
          const style = resolveCategoryStyle(c.icon, c.color, themeDefaultColor);
          const Icon = style.Icon;
          const count = countFor(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className="bg-white rounded-2xl border border-qf-line overflow-hidden text-start hover:border-(--qf-primary)/50 hover:shadow-md transition active:scale-[0.99]"
            >
              <div
                className="relative aspect-[4/3] overflow-hidden grid place-items-center"
                style={{ backgroundColor: style.bg }}
              >
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.imageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Icon size={44} color={style.fg} strokeWidth={1.5} />
                )}
              </div>
              <div className="px-3 py-2.5">
                <div className="font-bold text-sm lg:text-base leading-tight line-clamp-2">
                  {c.name}
                </div>
                <div className="text-xs text-qf-mute mt-0.5">{count} מוצרים</div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

function CategoryDetail({
  category,
  categories,
  items,
  businessType,
  featuredBadgeLabel,
  noticesByCategory,
  noticesByItem,
  itemHref,
  onItemOpen,
  onSelectCategory,
  onBack,
}: {
  category: CategoryRow;
  categories: CategoryRow[];
  items: MenuListItem[];
  businessType: BusinessType;
  featuredBadgeLabel?: string | null;
  noticesByCategory?: Map<string, NoticeRow[]>;
  noticesByItem?: Map<string, NoticeRow[]>;
  itemHref: (id: string) => string;
  onItemOpen?: () => void;
  onSelectCategory: (id: string) => void;
  onBack: () => void;
}) {
  const catNotices = noticesByCategory?.get(category.id) ?? [];
  return (
    <div>
      <div className="sticky top-0 z-20 -mx-5 px-5 py-2 bg-qf-bg/95 backdrop-blur lg:top-16 lg:mx-0 lg:px-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="חזרה לקטגוריות"
            className="shrink-0 w-9 h-9 rounded-full bg-white border border-qf-line grid place-items-center hover:border-(--qf-primary)/50 transition"
          >
            <IcoArrowLeft c="#2b2b2b" s={16} />
          </button>
          <div className="flex gap-1.5 overflow-x-auto qf-hscroll">
            {categories.map((c) => {
              const active = c.id === category.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectCategory(c.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition",
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
      </div>

      <h2 className="text-lg lg:text-2xl font-bold mt-3 mb-3">{category.name}</h2>
      {catNotices.length > 0 && (
        <div className="space-y-2 mb-3">
          {catNotices.map((n) => (
            <NoticeCard key={n.id} notice={n} />
          ))}
        </div>
      )}
      <ProductGrid
        items={items}
        businessType={businessType}
        featuredBadgeLabel={featuredBadgeLabel}
        noticesByItem={noticesByItem}
        itemHref={itemHref}
        onItemOpen={onItemOpen}
      />
    </div>
  );
}

function SearchResults({
  items,
  businessType,
  featuredBadgeLabel,
  noticesByItem,
  itemHref,
  onItemOpen,
}: {
  items: MenuListItem[];
  businessType: BusinessType;
  featuredBadgeLabel?: string | null;
  noticesByItem?: Map<string, NoticeRow[]>;
  itemHref: (id: string) => string;
  onItemOpen?: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center text-sm text-qf-mute py-10">
        לא נמצאו מוצרים תואמים
      </div>
    );
  }
  return (
    <ProductGrid
      items={items}
      businessType={businessType}
      featuredBadgeLabel={featuredBadgeLabel}
      noticesByItem={noticesByItem}
      itemHref={itemHref}
      onItemOpen={onItemOpen}
    />
  );
}

function ProductGrid({
  items,
  businessType,
  featuredBadgeLabel,
  noticesByItem,
  itemHref,
  onItemOpen,
}: {
  items: MenuListItem[];
  businessType: BusinessType;
  featuredBadgeLabel?: string | null;
  noticesByItem?: Map<string, NoticeRow[]>;
  itemHref: (id: string) => string;
  onItemOpen?: () => void;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
      {items.map((item) => (
        <ProductSquare
          key={item.id}
          item={item}
          businessType={businessType}
          featuredLabel={featuredBadgeLabel?.trim() || "מומלץ של השף"}
          itemNotices={noticesByItem?.get(item.id) ?? []}
          itemHref={itemHref}
          onItemOpen={onItemOpen}
        />
      ))}
    </div>
  );
}

function ProductSquare({
  item,
  businessType,
  featuredLabel,
  itemNotices,
  itemHref,
  onItemOpen,
}: {
  item: MenuListItem;
  businessType: BusinessType;
  featuredLabel: string;
  itemNotices: NoticeRow[];
  itemHref: (id: string) => string;
  onItemOpen?: () => void;
}) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  // Simple items (no sizes / option groups) drop straight into the cart from
  // the "+" - matching the Wolt-style flow. Anything with choices opens the
  // detail modal so the customer can configure it first.
  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    add({
      itemId: item.id,
      name: item.name,
      basePrice: item.basePrice,
      artType: item.artType,
      imageUrl: item.images?.[0] ?? null,
      quantity: 1,
      sizeId: null,
      sizeName: null,
      sizeDelta: 0,
      options: [],
      notes: null,
      source: "menu",
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  const image = (
    <div className="relative aspect-square overflow-hidden rounded-t-2xl">
      <MenuItemImage
        src={item.images?.[0]}
        alt={item.name}
        businessType={businessType}
        size={220}
        rounded="none"
        fill
        className="w-full h-full"
      />
      {item.featured && (
        <span
          className="absolute top-0 start-0 bg-(--qf-primary) text-white text-[10px] font-black px-2 py-1 rounded-se-xl rounded-es-xl shadow-sm z-10"
          aria-label={featuredLabel}
        >
          {featuredLabel}
        </span>
      )}
      {item.hasOptions ? (
        <span
          aria-hidden
          className="absolute bottom-2 end-2 w-9 h-9 rounded-full bg-white shadow-md border border-qf-line grid place-items-center text-(--qf-primary) pointer-events-none"
        >
          <Plus size={18} strokeWidth={2.4} />
        </span>
      ) : (
        <button
          type="button"
          onClick={handleAdd}
          aria-label="הוספה לעגלה"
          className={cn(
            "absolute bottom-2 end-2 w-9 h-9 rounded-full shadow-md border grid place-items-center transition z-10",
            added
              ? "bg-(--qf-primary) border-(--qf-primary) text-white"
              : "bg-white border-qf-line text-(--qf-primary) hover:border-(--qf-primary)",
          )}
        >
          {added ? <Check size={16} strokeWidth={3} /> : <Plus size={18} strokeWidth={2.4} />}
        </button>
      )}
    </div>
  );

  const footer = (
    <div className="p-3">
      <div className="font-bold tnum text-base">{formatPrice(item.basePrice)}</div>
      <div className="font-medium text-sm leading-tight line-clamp-2 mt-0.5">
        {item.name}
      </div>
      {itemNotices.length > 0 && (
        <div className="text-[11px] text-qf-mute line-clamp-1 mt-1">
          {itemNotices.map((n) => n.title).join(" · ")}
        </div>
      )}
    </div>
  );

  // Optioned items: the whole tile links to the detail modal. Simple items:
  // the tile is a static card; only the "+" acts (adds straight to cart).
  if (item.hasOptions) {
    return (
      <Link
        href={itemHref(item.id)}
        scroll={false}
        onClick={onItemOpen}
        className="block bg-white rounded-2xl border border-qf-line overflow-hidden hover:border-(--qf-primary)/50 hover:shadow-sm transition active:scale-[0.99]"
      >
        {image}
        {footer}
      </Link>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-qf-line overflow-hidden">
      {image}
      {footer}
    </div>
  );
}
