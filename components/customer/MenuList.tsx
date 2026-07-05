"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { resolveCategoryStyle, type CategoryColorKey } from "@/lib/category-style";
import { formatPrice } from "@/lib/format";
import { FILTERABLE_TAG_LABELS, findTag, TONE_CLASSES } from "@/lib/dietary-tags";
import { cn } from "@/lib/cn";

export interface MenuListItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  basePrice: number;
  artType: string | null;
  images?: string[];
  tags: string[];
  featured?: boolean;
}

export type NoticeScope = "store" | "category" | "item";
export type NoticeKind = "info" | "warning" | "allergen" | "kosher" | "dietary";

export interface NoticeRow {
  id: string;
  scope: NoticeScope;
  categoryId: string | null;
  itemId: string | null;
  kind: NoticeKind;
  title: string;
  body: string | null;
}

const NOTICE_STYLES: Record<NoticeKind, { wrap: string; chip: string; label: string }> = {
  info: {
    wrap: "bg-qf-blue-soft border-qf-blue/40",
    chip: "bg-qf-blue text-white",
    label: "מידע",
  },
  warning: {
    wrap: "bg-qf-tomato-soft border-qf-tomato/40",
    chip: "bg-qf-tomato text-white",
    label: "אזהרה",
  },
  allergen: {
    wrap: "bg-qf-warm-dash border-qf-yolk/50",
    chip: "bg-qf-yolk text-qf-ink",
    label: "אלרגן",
  },
  kosher: {
    wrap: "bg-qf-green-soft border-qf-green-line",
    chip: "bg-qf-green-deep text-white",
    label: "כשרות",
  },
  dietary: {
    wrap: "bg-qf-line-soft border-qf-line-dash",
    chip: "bg-qf-ink2 text-white",
    label: "תזונתי",
  },
};

export function NoticeCard({ notice }: { notice: NoticeRow }) {
  const style = NOTICE_STYLES[notice.kind];
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed px-4 py-3 flex items-start gap-3",
        style.wrap,
      )}
      role="note"
    >
      <span
        className={cn(
          "shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide",
          style.chip,
        )}
      >
        {style.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-qf-ink leading-tight">{notice.title}</div>
        {notice.body && (
          <div className="text-xs text-qf-ink2 mt-1 leading-relaxed">{notice.body}</div>
        )}
      </div>
    </div>
  );
}

function NoticeChip({ notice }: { notice: NoticeRow }) {
  const style = NOTICE_STYLES[notice.kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold border",
        style.wrap,
      )}
      title={notice.body ?? undefined}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.chip)} aria-hidden />
      {notice.title}
    </span>
  );
}

interface Props {
  tenantSlug: string;
  businessType?: BusinessType;
  categories: Array<{ id: string; name: string; icon: string | null; color: string | null }>;
  items: MenuListItem[];
  query?: string;
  activeTags?: Set<string>;
  /** Render the dietary-tag chip row above the sticky category bar. */
  showTagFilter?: boolean;
  onToggleTag?: (tag: string) => void;
  onClearTags?: () => void;
  /** CSS offset between viewport top and the line below the sticky chip bar. */
  scrollOffset?: number;
  /** When provided, the wrapper gets this `id` so other components
   *  (eg BottomTabBar) can observe it for scroll-spy. */
  rootId?: string;
  /** Category- and item-scoped notices rendered inline. Store-scoped
   *  notices are not handled here - render those above this component. */
  noticesByCategory?: Map<string, NoticeRow[]>;
  noticesByItem?: Map<string, NoticeRow[]>;
  onItemClick?: (id: string) => void;
  /** Label rendered on the corner of cards whose item.featured===true.
   *  Empty / undefined → the platform default ("מומלץ של השף"). */
  featuredBadgeLabel?: string | null;
  /** Fallback color for categories that have no explicit color set.
   *  Defaults to "green" when omitted. */
  themeDefaultColor?: CategoryColorKey;
}

export function MenuList({
  tenantSlug,
  businessType = "general",
  categories,
  items,
  query = "",
  activeTags,
  showTagFilter = false,
  onToggleTag,
  onClearTags,
  scrollOffset = 80,
  rootId,
  noticesByCategory,
  noticesByItem,
  onItemClick,
  featuredBadgeLabel,
  themeDefaultColor,
}: Props) {
  const featuredLabel = featuredBadgeLabel?.trim() || "מומלץ של השף";
  const availableTags = useMemo(() => {
    const usage = new Set<string>();
    for (const it of items) for (const t of it.tags) usage.add(t);
    return FILTERABLE_TAG_LABELS.filter((t) => usage.has(t));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q) && !i.description.toLowerCase().includes(q)) {
        return false;
      }
      if (activeTags) {
        for (const t of activeTags) {
          if (!i.tags.includes(t)) return false;
        }
      }
      return true;
    });
  }, [items, query, activeTags]);

  const byCategory = useMemo(() => {
    const groups: Record<string, MenuListItem[]> = {};
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
        rootMargin: `-${scrollOffset + 20}px 0px -65% 0px`,
        threshold: 0,
      },
    );
    for (const c of visibleCategories) {
      const el = sectionRefs.current[c.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [visibleCategories, scrollOffset]);

  useEffect(() => {
    const el = chipRefs.current[activeCat];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCat]);

  const handleChipClick = (catId: string) => {
    setActiveCat(catId);
    const el = sectionRefs.current[catId];
    if (!el) return;
    scrollLockRef.current = true;
    const top = el.getBoundingClientRect().top + window.scrollY - scrollOffset;
    window.scrollTo({ top, behavior: "smooth" });
    window.setTimeout(() => {
      scrollLockRef.current = false;
    }, 700);
  };

  return (
    <div id={rootId} className="min-w-0">
      {showTagFilter && availableTags.length > 0 && (
        <div className="px-5 mb-2 flex gap-1.5 overflow-x-auto no-scrollbar lg:px-0">
          {availableTags.map((t) => {
            const meta = findTag(t);
            const active = activeTags?.has(t) ?? false;
            const tone = meta ? TONE_CLASSES[meta.tone] : TONE_CLASSES.muted;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onToggleTag?.(t)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition shrink-0",
                  active
                    ? "bg-(--qf-primary) text-white border-(--qf-primary)"
                    : cn(tone.bg, tone.text, "border-transparent hover:bg-opacity-80"),
                )}
              >
                {t}
              </button>
            );
          })}
          {activeTags && activeTags.size > 0 && (
            <button
              type="button"
              onClick={() => onClearTags?.()}
              className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap text-qf-mute hover:text-qf-ink shrink-0"
            >
              נקה הכל
            </button>
          )}
        </div>
      )}

      <div className="sticky top-15 z-20 bg-qf-bg/95 backdrop-blur border-b border-qf-line lg:top-16 lg:mt-0">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 py-2.5">
          {visibleCategories.map((c) => {
            const active = activeCat === c.id;
            const style = resolveCategoryStyle(c.icon, c.color, themeDefaultColor);
            const Icon = style.Icon;
            return (
              <button
                key={c.id}
                ref={(el) => {
                  chipRefs.current[c.id] = el;
                }}
                type="button"
                onClick={() => handleChipClick(c.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm whitespace-nowrap border transition inline-flex items-center gap-1.5",
                  active
                    ? "bg-(--qf-primary) text-white border-transparent"
                    : "bg-white text-qf-ink2 border-qf-line",
                )}
              >
                <span
                  className="w-5 h-5 rounded-full grid place-items-center shrink-0"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.18)" : style.bg }}
                  aria-hidden
                >
                  <Icon size={11} color={active ? "#fff" : style.fg} strokeWidth={2} />
                </span>
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 mt-3 space-y-6 lg:px-0 lg:mt-6">
        {visibleCategories.map((c) => {
          const list = byCategory[c.id] ?? [];
          const catNotices = noticesByCategory?.get(c.id) ?? [];
          return (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              ref={(el) => {
                sectionRefs.current[c.id] = el;
              }}
              data-cat-id={c.id}
              className="space-y-2.5 scroll-mt-20 lg:scroll-mt-32"
            >
              <h2 className="font-semibold text-base lg:text-xl">{c.name}</h2>
              {catNotices.length > 0 && (
                <div className="space-y-2">
                  {catNotices.map((n) => (
                    <NoticeCard key={n.id} notice={n} />
                  ))}
                </div>
              )}
              <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
                {list.map((item) => {
                  const itemNotices = noticesByItem?.get(item.id) ?? [];
                  const tags = item.tags.slice(0, 3);
                  return (
                    <Link
                      key={item.id}
                      href={`?item=${item.id}`}
                      scroll={false}
                      onClick={() => onItemClick?.(item.id)}
                      className="relative bg-white rounded-2xl border border-qf-line p-3 pe-3.5 flex gap-3 transition active:scale-[0.99] active:bg-qf-line-soft hover:border-(--qf-primary)/40 hover:shadow-sm overflow-hidden"
                    >
                      {item.featured && (
                        <span
                          className="absolute top-0 start-0 bg-(--qf-primary) text-white text-[10px] font-black px-2 py-1 rounded-se-xl rounded-es-xl shadow-sm z-10"
                          aria-label={featuredLabel}
                        >
                          {featuredLabel}
                        </span>
                      )}
                      <div className="relative w-24 h-24 shrink-0">
                        <div className="w-full h-full rounded-xl overflow-hidden">
                          <MenuItemImage
                            src={item.images?.[0]}
                            alt={item.name}
                            businessType={businessType}
                            size={96}
                            rounded="xl"
                            className="w-full h-full"
                          />
                        </div>
                        <span
                          aria-hidden
                          className="absolute bottom-1 -inset-e-2 w-8 h-8 rounded-full bg-white shadow-md border border-qf-line grid place-items-center text-(--qf-primary) text-xl leading-none font-light pointer-events-none"
                        >
                          +
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="font-semibold leading-tight">{item.name}</div>
                          <div className="text-xs text-qf-mute line-clamp-2 mt-0.5">
                            {item.description}
                          </div>
                          {(tags.length > 0 || itemNotices.length > 0) && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {itemNotices.map((n) => (
                                <NoticeChip key={n.id} notice={n} />
                              ))}
                              {tags.map((t) => {
                                const meta = findTag(t);
                                const tone = meta ? TONE_CLASSES[meta.tone] : TONE_CLASSES.green;
                                return (
                                  <span
                                    key={t}
                                    className={cn(
                                      "text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                                      tone.bg,
                                      tone.text,
                                    )}
                                  >
                                    {t}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="font-bold tnum text-base">{formatPrice(item.basePrice)}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
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
    </div>
  );
}
