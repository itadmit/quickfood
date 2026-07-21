"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IcoChev, IcoMinus, IcoPlus, IcoHeart, IcoCheck, IcoClose, IcoEdit } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import {
  useCart,
  type CartLine,
  type CartLineSource,
} from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { priceGroupOptions, type PricedOption, type GroupPricingConfig } from "@/lib/option-pricing";
import { cn } from "@/lib/cn";

const KIOSK_NOTE_PRESETS = [
  "בלי בצל",
  "אפשר בלי פטרוזיליה?",
  "ללא גלוטן",
  "לחתוך ל-2",
  "עוד רוטב",
  "שיהיה קריספי",
];

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
  halfPriceDelta?: number | null;
  isDefault: boolean;
  imageUrl?: string | null;
  maxQuantity?: number;
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
  allowQty?: boolean;
  splitPrice?: boolean;
  customHalfPrice?: boolean;
  bundleCount?: number;
  bundlePrice?: number;
  maxPerSide?: number | null;
  options: Option[];
}
interface ItemData {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  artType: string | null;
  images?: string[];
  imageNote?: string | null;
  upsellSizeNudge?: boolean;
  tags: string[];
  stockRemaining?: number | null;
  sizes: Size[];
  optionGroups: OptionGroup[];
}

export function ItemDetail({
  tenantSlug,
  item,
  businessType = "general",
  inModal = false,
  kioskMode = false,
  onNotesKeyboard,
  onClose,
  editLine,
  addSource = "menu",
}: {
  tenantSlug: string;
  item: ItemData;
  businessType?: BusinessType;
  inModal?: boolean;
  /** Rendered inside the kiosk overlay - drops the mobile-narrow
   *  max-w-md cap on the footer CTA and bumps touch targets so the
   *  bar actually feels tappable on a 10–13" tablet in landscape. */
  kioskMode?: boolean;
  // Kiosk: invoked when "כתבו הערה חופשית" is tapped so the parent can
  // mount its on-screen Hebrew keyboard bound to the notes value.
  onNotesKeyboard?: (current: string, set: (next: string) => void) => void;
  onClose?: () => void;
  editLine?: CartLine;
  /** Provenance tag attached to the cart line when this detail screen
   *  results in a new add. Defaults to "menu" - override from CartUpsell,
   *  AI flows, reorder rails, etc. */
  addSource?: CartLineSource;
}) {
  const router = useRouter();
  const { add, updateLine, tenant, branch, lines } = useCart();
  const isEditing = !!editLine;
  const upsellSizeNudge =
    tenant.upsellSizeNudge !== false && item.upsellSizeNudge !== false;
  const branchClosed = branch?.status === "closed";

  const inCartQty = lines.reduce(
    (acc, l) =>
      acc + (l.itemId === item.id && l.lineId !== editLine?.lineId ? l.quantity : 0),
    0,
  );
  const stockLeft =
    item.stockRemaining != null ? Math.max(0, item.stockRemaining - inCartQty) : null;
  const outOfStock = stockLeft === 0;
  const maxQty = Math.min(20, stockLeft ?? 20);

  const defaultSize = item.sizes.find((s) => s.isDefault) ?? item.sizes[0] ?? null;
  const [sizeId, setSizeId] = useState<string | null>(editLine?.sizeId ?? defaultSize?.id ?? null);

  const [picks, setPicks] = useState<Record<string, Set<string>>>(() => {
    const initial: Record<string, Set<string>> = {};
    if (editLine) {
      // Pre-populate from the existing cart line. Half-and-half picks
      // live in the `half` field, so they go in halfPicks below - here
      // we only seed flat single/multi selections.
      for (const g of item.optionGroups) {
        if (g.allowHalf) continue;
        const set = new Set<string>();
        for (const o of editLine.options) {
          if (o.groupId === g.id && !o.half) set.add(o.optionId);
        }
        initial[g.id] = set;
      }
    } else {
      for (const g of item.optionGroups) {
        if (!g.allowHalf) {
          initial[g.id] = new Set(g.options.filter((o) => o.isDefault).map((o) => o.id));
        }
      }
    }
    return initial;
  });

  // Wolt-style per-option quantity inside multi groups (3× טחינה). Only
  // options present in `picks` count; a picked option with no entry here
  // is quantity 1.
  const [optQtys, setOptQtys] = useState<Record<string, Record<string, number>>>(() => {
    const initial: Record<string, Record<string, number>> = {};
    if (editLine) {
      for (const g of item.optionGroups) {
        if (g.allowHalf) continue;
        const m: Record<string, number> = {};
        for (const o of editLine.options) {
          if (o.groupId === g.id && !o.half) m[o.optionId] = (m[o.optionId] ?? 0) + 1;
        }
        initial[g.id] = m;
      }
    }
    return initial;
  });

  // For allowHalf groups: maps optionId → placement ("left"|"right"|"full")
  const [halfPicks, setHalfPicks] = useState<Record<string, Record<string, HalfPlacement>>>(() => {
    const initial: Record<string, Record<string, HalfPlacement>> = {};
    for (const g of item.optionGroups) {
      if (!g.allowHalf) continue;
      const m: Record<string, HalfPlacement> = {};
      if (editLine) {
        for (const o of editLine.options) {
          if (o.groupId === g.id && o.half) m[o.optionId] = o.half;
        }
      }
      initial[g.id] = m;
    }
    return initial;
  });

  const [quantity, setQuantity] = useState(editLine?.quantity ?? 1);
  const [notes, setNotes] = useState(editLine?.notes ?? "");
  const [flashGroupId, setFlashGroupId] = useState<string | null>(null);
  const [addPhase, setAddPhase] = useState<"idle" | "loading" | "done">("idle");
  const [lightbox, setLightbox] = useState<"closed" | "open" | "closing">("closed");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (maxQty >= 1 && quantity > maxQty) setQuantity(maxQty);
  }, [maxQty, quantity]);

  // Favorite state. Asked once on mount via the existing
  // /api/v1/customer/favorites GET (filtered to this tenant). Guest
  // sessions return 401 and we silently leave the heart unfilled - the
  // click handler shows the login hint then.
  const [favorited, setFavorited] = useState(false);
  const [favoriteFlash, setFavoriteFlash] = useState<"saved" | "auth" | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/v1/customer/favorites?tenant_slug=${encodeURIComponent(tenantSlug)}`, {
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json() as Promise<{ favorites: Array<{ item_id: string }> }>;
      })
      .then((data) => {
        if (!data) return;
        setFavorited(data.favorites.some((f) => f.item_id === item.id));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [tenantSlug, item.id]);

  async function toggleFavorite() {
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    const prev = favorited;
    setFavorited(!prev);
    try {
      const res = await fetch(`/api/v1/customer/favorites/${item.id}`, { method: "POST" });
      if (res.status === 401) {
        setFavorited(prev);
        setFavoriteFlash("auth");
        window.setTimeout(() => setFavoriteFlash(null), 2200);
        return;
      }
      if (!res.ok) {
        setFavorited(prev);
        return;
      }
      const data = (await res.json()) as { favorited?: boolean };
      if (typeof data.favorited === "boolean") setFavorited(data.favorited);
      setFavoriteFlash("saved");
      window.setTimeout(() => setFavoriteFlash(null), 1400);
    } finally {
      setFavoriteBusy(false);
    }
  }

  const images = item.images ?? [];
  const [activeImage, setActiveImage] = useState(0);
  const heroImage = images[activeImage] ?? images[0];
  const canZoom = !!heroImage;
  const heroTrackRef = useRef<HTMLDivElement | null>(null);
  function onHeroScroll() {
    const el = heroTrackRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    setActiveImage(Math.min(images.length - 1, Math.max(0, idx)));
  }

  const closeTimerRef = useRef<number | null>(null);
  function openLightbox(index?: number) {
    if (!canZoom) return;
    if (typeof index === "number") setActiveImage(index);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setLightbox("open");
  }
  function closeLightbox() {
    setLightbox((prev) => {
      if (prev !== "open") return prev;
      closeTimerRef.current = window.setTimeout(() => {
        setLightbox("closed");
        closeTimerRef.current = null;
      }, 240);
      return "closing";
    });
  }
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (lightbox === "closed") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

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

  function optionQty(g: OptionGroup, optionId: string): number {
    if (!picks[g.id]?.has(optionId)) return 0;
    if (!g.allowQty || g.type !== "multi" || g.maxSelect <= 1) return 1;
    return Math.max(1, optQtys[g.id]?.[optionId] ?? 1);
  }

  // One PricedOption per unit: an option picked 3 times becomes three
  // entries keyed "<id>#0..2" so the cheapest-free / bundle allocation in
  // priceGroupOptions treats every unit as its own pick. Callers map the
  // synthetic key back to the real id by cutting at "#".
  function pickedOptions(g: OptionGroup): PricedOption[] {
    if (g.allowHalf) {
      const gHalf = halfPicks[g.id] ?? {};
      return g.options
        .filter((o) => gHalf[o.id])
        .map((o) => ({ id: `${o.id}#0`, priceDelta: o.priceDelta, halfPriceDelta: o.halfPriceDelta, half: gHalf[o.id] }));
    }
    const out: PricedOption[] = [];
    for (const o of g.options) {
      const q = optionQty(g, o.id);
      for (let i = 0; i < q; i++) {
        out.push({ id: `${o.id}#${i}`, priceDelta: o.priceDelta, halfPriceDelta: o.halfPriceDelta });
      }
    }
    return out;
  }

  function groupUnits(g: OptionGroup): number {
    if (g.allowHalf) return Object.keys(halfPicks[g.id] ?? {}).length;
    let n = 0;
    for (const id of picks[g.id] ?? []) n += optionQty(g, id);
    return n;
  }

  function groupPricingConfig(g: OptionGroup): GroupPricingConfig {
    return {
      includedFree: g.includedFree ?? 0,
      bundleCount: g.bundleCount ?? 0,
      bundlePrice: g.bundlePrice ?? 0,
      splitPrice: g.splitPrice ?? false,
      customHalfPrice: g.customHalfPrice ?? false,
    };
  }

  function withBundleNote(g: OptionGroup, subtitle: string | null | undefined): string | undefined {
    if (!g.bundleCount || !g.bundlePrice) return subtitle ?? undefined;
    const note = `מבצע: ${g.bundleCount} ב-${formatPrice(g.bundlePrice)}`;
    return subtitle ? `${note} · ${subtitle}` : note;
  }

  const total = useMemo(() => {
    const size = item.sizes.find((s) => s.id === sizeId);
    const sDelta = size?.priceDelta ?? 0;
    let oDelta = 0;
    for (const g of item.optionGroups) {
      const picked = pickedOptions(g);
      if (picked.length === 0) continue;
      const charges = priceGroupOptions(picked, groupPricingConfig(g));
      for (const c of charges.values()) oDelta += c;
    }
    return (item.basePrice + sDelta + oDelta) * quantity;
  }, [item, sizeId, picks, optQtys, halfPicks, quantity]);

  const missingGroup = useMemo(() => {
    for (const g of item.optionGroups) {
      // A group marked חובה must always require at least one pick - even
      // if the catalog's minSelect leaked through as 0 (a known artefact
      // of the Wolt importer that doesn't always seed the floor).
      const floor = g.required ? Math.max(1, g.minSelect) : g.minSelect;
      if (g.required && groupUnits(g) < floor) return g;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.optionGroups, picks, optQtys, halfPicks]);

  function setPickState(group: OptionGroup, optionId: string, qty: number) {
    setPicks((prev) => {
      const set = new Set(prev[group.id] ?? []);
      if (qty > 0) set.add(optionId);
      else set.delete(optionId);
      return { ...prev, [group.id]: set };
    });
    setOptQtys((prev) => ({ ...prev, [group.id]: { ...prev[group.id], [optionId]: qty } }));
  }

  function toggleOption(group: OptionGroup, optionId: string) {
    if (group.type === "single" || group.maxSelect === 1) {
      // Radio behavior: one tap swaps the choice. Re-tapping the selected
      // option clears it only when the group is optional; a required group
      // always keeps a pick.
      const current = picks[group.id] ?? new Set<string>();
      setPicks((prev) => ({
        ...prev,
        [group.id]:
          current.has(optionId) && !group.required ? new Set<string>() : new Set([optionId]),
      }));
      return;
    }
    if (picks[group.id]?.has(optionId)) {
      setPickState(group, optionId, 0);
    } else {
      if (groupUnits(group) >= group.maxSelect) return;
      setPickState(group, optionId, 1);
    }
  }

  function bumpOptionQty(group: OptionGroup, optionId: string, delta: 1 | -1) {
    const next = optionQty(group, optionId) + delta;
    if (delta > 0 && groupUnits(group) >= group.maxSelect) return;
    const cap = group.options.find((o) => o.id === optionId)?.maxQuantity ?? 0;
    if (delta > 0 && cap > 0 && optionQty(group, optionId) >= cap) return;
    setPickState(group, optionId, Math.max(0, next));
  }

  function toggleHalf(group: OptionGroup, optionId: string, placement: HalfPlacement) {
    setHalfPicks((prev) => {
      const gMap = { ...(prev[group.id] ?? {}) };
      const cap = group.maxPerSide ?? null;

      if (gMap[optionId] === placement) {
        delete gMap[optionId];
        return { ...prev, [group.id]: gMap };
      }

      if (cap != null) {
        const nextMap = { ...gMap, [optionId]: placement };
        let left = 0;
        let right = 0;
        for (const p of Object.values(nextMap)) {
          if (p === "left" || p === "full") left += 1;
          if (p === "right" || p === "full") right += 1;
        }
        if (left > cap || right > cap) return prev;
        gMap[optionId] = placement;
      } else {
        const count = Object.keys(gMap).length;
        if (!gMap[optionId] && count >= group.maxSelect) return prev;
        gMap[optionId] = placement;
      }
      return { ...prev, [group.id]: gMap };
    });
  }

  function addToCart() {
    if (branchClosed) return;
    if (missingGroup) {
      const el = document.getElementById(`group-${missingGroup.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashGroupId(missingGroup.id);
      window.setTimeout(() => setFlashGroupId(null), 1400);
      return;
    }
    const size = item.sizes.find((s) => s.id === sizeId);
    const selectedOpts: Array<{ groupId: string; optionId: string; name: string; groupName: string; priceDelta: number; half?: HalfPlacement }> = [];
    for (const g of item.optionGroups) {
      const picked = pickedOptions(g);
      if (picked.length === 0) continue;
      const charges = priceGroupOptions(picked, groupPricingConfig(g));
      for (const unit of picked) {
        const optionId = unit.id.slice(0, unit.id.indexOf("#"));
        const o = g.options.find((x) => x.id === optionId);
        if (!o) continue;
        const placement = g.allowHalf ? (halfPicks[g.id]?.[optionId] as HalfPlacement | undefined) : undefined;
        selectedOpts.push({
          groupId: g.id,
          optionId,
          name: o.name,
          groupName: g.name,
          priceDelta: charges.get(unit.id) ?? o.priceDelta,
          ...(placement ? { half: placement } : {}),
        });
      }
    }
    const payload = {
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
      stockRemaining: item.stockRemaining ?? null,
    };
    if (isEditing && editLine) {
      updateLine(editLine.lineId, { ...payload, source: editLine.source });
    } else {
      add({ ...payload, source: addSource });
    }
    setAddPhase("loading");
    window.setTimeout(() => setAddPhase("done"), 380);
    if (inModal) {
      window.setTimeout(() => onClose?.(), 780);
    } else if (isEditing) {
      window.setTimeout(() => onClose?.(), 780);
    } else {
      window.setTimeout(() => {
        window.scrollTo(0, 0);
        router.push(`/s/${tenantSlug}/cart`);
      }, 780);
    }
  }

  const ctaLabel = branchClosed
    ? "המסעדה סגורה"
    : outOfStock
      ? "אזל מהמלאי"
      : missingGroup
        ? `בחר ${missingGroup.name}`
        : isEditing
          ? "עדכן הזמנה"
          : "הוסף לסל";

  return (
    <div
      className={cn(
        "pb-36",
        !inModal && "lg:pb-12",
        inModal && kioskMode && "lg:pb-0",
        // Card chrome only on the full-page route; inside the modal
        // the wrapper provides its own card surface.
        !inModal &&
          "lg:max-w-4xl lg:mx-auto lg:mt-8 lg:bg-white lg:rounded-3xl lg:shadow-xl lg:overflow-hidden",
      )}
    >
      {/* Sticky top bar - mobile only on the full page. Inside the
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
        {images.length > 1 ? (
          <div
            className={cn(
              "relative overflow-hidden bg-qf-line-soft",
              inModal
                ? "h-64 sm:h-80 lg:h-105"
                : "h-72 lg:h-96 rounded-b-3xl lg:rounded-none",
            )}
          >
            <div
              ref={heroTrackRef}
              onScroll={onHeroScroll}
              className="flex h-full w-full overflow-x-auto snap-x snap-mandatory scrollbar-none [&::-webkit-scrollbar]:hidden"
            >
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => openLightbox(i)}
                  aria-label="הגדל תמונה"
                  className="relative shrink-0 w-full h-full snap-center cursor-zoom-in"
                >
                  <MenuItemImage
                    src={src}
                    alt={item.name}
                    businessType={businessType}
                    size={520}
                    rounded="none"
                    fill
                  />
                </button>
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/30 to-transparent pointer-events-none" />
            <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 pointer-events-none">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    i === activeImage ? "w-5 bg-white" : "w-1.5 bg-white/60",
                  )}
                />
              ))}
            </div>
          </div>
        ) : canZoom ? (
          <button
            type="button"
            onClick={() => openLightbox(0)}
            aria-label="הגדל תמונה"
            className={cn(
              "relative overflow-hidden bg-qf-line-soft block w-full text-start cursor-zoom-in",
              inModal
                ? "h-64 sm:h-80 lg:h-105"
                : "h-72 lg:h-96 rounded-b-3xl lg:rounded-none",
            )}
          >
            <MenuItemImage
              src={heroImage}
              alt={item.name}
              businessType={businessType}
              size={520}
              rounded="none"
              fill
            />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/30 to-transparent pointer-events-none" />
          </button>
        ) : (
          <div
            className={cn(
              "relative overflow-hidden bg-qf-line-soft",
              inModal
                ? "h-64 sm:h-80 lg:h-105"
                : "h-72 lg:h-96 rounded-b-3xl lg:rounded-none",
            )}
          >
            <MenuItemImage
              src={heroImage}
              alt={item.name}
              businessType={businessType}
              size={520}
              rounded="none"
              fill
            />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/30 to-transparent pointer-events-none" />
          </div>
        )}
        {item.imageNote && (
          <span className="absolute bottom-3 end-3 z-10 px-2 py-0.5 rounded-md bg-black/45 backdrop-blur-sm text-white/90 text-[10px] font-medium pointer-events-none">
            {item.imageNote}
          </span>
        )}
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
          onClick={toggleFavorite}
          disabled={favoriteBusy}
          className="absolute top-4 inset-e-4 w-10 h-10 rounded-full bg-white/95 backdrop-blur shadow-md grid place-items-center transition active:scale-95"
          aria-label={favorited ? "הסר ממועדפים" : "הוסף למועדפים"}
          aria-pressed={favorited}
        >
          <IcoHeart
            s={18}
            c={favorited ? "#dc2626" : "#11231a"}
            fill={favorited ? "#dc2626" : "none"}
          />
        </button>
        {favoriteFlash && (
          <div
            className="absolute top-16 inset-e-4 z-10 px-3 py-1.5 rounded-lg bg-black/85 text-white text-xs font-medium shadow-lg animate-qf-slide-up"
            role="status"
          >
            {favoriteFlash === "saved"
              ? favorited
                ? "נשמר במועדפים"
                : "הוסר מהמועדפים"
              : "צריך להתחבר כדי לסמן מועדפים"}
          </div>
        )}
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
      {item.sizes.length > 0 && (() => {
        // Size-upgrade nudge: when there's a larger size than what the
        // user has currently selected, show a bold banner above the
        // size picker so the upsell can't be missed. "Larger" = higher
        // priceDelta. Tap → select that size, banner hides. Opt-out
        // per-tenant via Settings → Sales (upsell_size_nudge=false).
        const currentSize = item.sizes.find((s) => s.id === sizeId);
        const sorted = [...item.sizes].sort((a, b) => b.priceDelta - a.priceDelta);
        const largest = sorted[0];
        const upgradeTo =
          upsellSizeNudge &&
          item.sizes.length > 1 &&
          currentSize &&
          largest &&
          largest.id !== currentSize.id &&
          largest.priceDelta > currentSize.priceDelta
            ? largest
            : null;
        const upgradeDelta = upgradeTo
          ? upgradeTo.priceDelta - (currentSize?.priceDelta ?? 0)
          : 0;
        return (
          <>
            {upgradeTo && upgradeDelta > 0 && (
              <button
                type="button"
                onClick={() => setSizeId(upgradeTo.id)}
                className="mt-2 mx-5 block w-[calc(100%-2.5rem)] rounded-2xl border-2 border-(--qf-primary) bg-(--qf-soft) p-4 text-start hover:bg-(--qf-primary)/15 transition active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  {heroImage && (
                    <img
                      src={heroImage}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                    <span className="text-sm font-black text-(--qf-deep)">
                      שדרגו ל-{upgradeTo.name} בתוספת {formatPrice(upgradeDelta)} בלבד
                    </span>
                    <span className="text-xs bg-(--qf-primary) text-white px-2 py-1 rounded-full font-bold whitespace-nowrap">
                      שדרג
                    </span>
                  </div>
                </div>
              </button>
            )}
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
          </>
        );
      })()}

      {/* Option groups */}
      {item.optionGroups.map((g) => {
        if (g.allowHalf) {
          const gHalf = halfPicks[g.id] ?? {};
          const cap = g.maxPerSide ?? null;

          let leftCount = 0;
          let rightCount = 0;
          for (const p of Object.values(gHalf)) {
            if (p === "left" || p === "full") leftCount += 1;
            if (p === "right" || p === "full") rightCount += 1;
          }
          const totalDistinct = Object.keys(gHalf).length;

          const selected = cap != null ? Math.max(leftCount, rightCount) : totalDistinct;
          const sectionMax = cap ?? g.maxSelect;
          const atMax = cap != null
            ? leftCount >= cap && rightCount >= cap
            : totalDistinct >= g.maxSelect;
          const minHalf = g.required ? Math.max(1, g.minSelect) : g.minSelect;

          const counterLabel = cap != null
            ? `צד א׳: ${leftCount}/${cap} · צד ב׳: ${rightCount}/${cap}`
            : null;
          const subtitle = g.required
            ? totalDistinct >= minHalf
              ? counterLabel ?? `הושלם · ${totalDistinct}/${g.maxSelect}`
              : counterLabel ?? `חובה ${minHalf}-${g.maxSelect} · ${totalDistinct}/${g.maxSelect}`
            : atMax
              ? counterLabel ?? `הגעת למקסימום · ${g.maxSelect}/${g.maxSelect}`
              : counterLabel ?? `אפשר לבחור עד ${g.maxSelect} · כל תוספת ניתן לקבוע לחצי פיצה`;

          return (
            <Section
              key={g.id}
              id={`group-${g.id}`}
              title={g.name}
              required={g.required}
              subtitle={withBundleNote(g, subtitle)}
              counter={sectionMax > 1 ? { selected, max: sectionMax, atMax } : undefined}
              helpText={g.helpText}
              flash={flashGroupId === g.id}
            >
              {g.options.map((o) => {
                const placement = gHalf[o.id] as HalfPlacement | undefined;
                const halfPrice = g.customHalfPrice
                  ? (o.halfPriceDelta ?? o.priceDelta)
                  : g.splitPrice
                    ? o.priceDelta / 2
                    : o.priceDelta;

                const wouldExceed = (p: HalfPlacement) => {
                  if (cap == null) return false;
                  if (placement === p) return false;
                  let l = leftCount;
                  let r = rightCount;
                  if (placement === "left" || placement === "full") l -= 1;
                  if (placement === "right" || placement === "full") r -= 1;
                  if (p === "left" || p === "full") l += 1;
                  if (p === "right" || p === "full") r += 1;
                  return l > cap || r > cap;
                };
                const blockedAll = !placement && atMax;
                const rowBlocked = blockedAll
                  || (cap != null && !placement && wouldExceed("left") && wouldExceed("full") && wouldExceed("right"));

                return (
                  <div key={o.id} className={cn("flex items-center gap-2 px-4 py-3 border-b border-qf-line last:border-0", rowBlocked && "opacity-40")}>
                    {o.imageUrl && (
                      <img
                        src={o.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{o.name}</div>
                      {o.priceDelta > 0 && (
                        <div className="text-xs text-qf-ink2 mt-0.5">
                          {g.splitPrice || g.customHalfPrice
                            ? `שלם +${formatPrice(o.priceDelta)} · חצי +${formatPrice(halfPrice)}`
                            : `+${formatPrice(o.priceDelta)}`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(["left", "full", "right"] as HalfPlacement[]).map((p) => {
                        const buttonBlocked = rowBlocked
                          ? placement !== p
                          : wouldExceed(p);
                        const label = p === "left" ? "חצי א׳" : p === "right" ? "חצי ב׳" : "שלם";
                        return (
                          <button
                            key={p}
                            type="button"
                            disabled={buttonBlocked}
                            onClick={() => { if (!buttonBlocked) toggleHalf(g, o.id, p); }}
                            aria-label={label}
                            title={label}
                            className={cn(
                              "w-9 h-9 rounded-full border-2 transition grid place-items-center",
                              placement === p
                                ? "border-(--qf-primary) text-(--qf-primary) bg-(--qf-soft)"
                                : "border-qf-line-dash text-qf-ink2 bg-white hover:border-(--qf-primary)",
                              buttonBlocked && "opacity-40 cursor-not-allowed",
                            )}
                          >
                            <HalfIcon side={p} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Section>
          );
        }

        const free = g.includedFree ?? 0;
        const selected = groupUnits(g);
        const remaining = Math.max(0, g.maxSelect - selected);
        const atMax = selected >= g.maxSelect;
        const freeRemaining = Math.max(0, free - selected);
        // Wolt-style free picks: while the group still has free slots left,
        // paid options show no price at all - the price tag appears only
        // once the free allowance is used up. Bundle groups keep their
        // explicit prices (the bundle note explains the deal).
        const hidePriceWhileFree = free > 0 && !(g.bundleCount && g.bundlePrice);
        const groupCharges = new Map<string, number>();
        if (hidePriceWhileFree && selected > 0) {
          const charges = priceGroupOptions(pickedOptions(g), groupPricingConfig(g));
          for (const [key, charge] of charges) {
            const realId = key.slice(0, key.indexOf("#"));
            groupCharges.set(realId, (groupCharges.get(realId) ?? 0) + charge);
          }
        }
        // A maxSelect at/above the number of options is effectively "no
        // limit" (the data often carries a 999 sentinel). Don't surface the
        // raw cap as "4/999" / "אפשר לבחור עוד 995".
        const unlimited = g.type === "multi" && g.maxSelect >= g.options.length;

        let subtitle: string;
        if (g.required) {
          const effectiveMin = Math.max(1, g.minSelect);
          if (g.type === "single") {
            subtitle = selected > 0 ? "נבחר" : "חובה לבחור 1";
          } else if (unlimited) {
            subtitle = selected >= effectiveMin
              ? `הושלם · נבחרו ${selected}`
              : `חובה לבחור לפחות ${effectiveMin} · נבחרו ${selected}`;
          } else {
            const range =
              effectiveMin === g.maxSelect
                ? `${effectiveMin}`
                : `${effectiveMin}-${g.maxSelect}`;
            subtitle = selected >= effectiveMin
              ? `הושלם · ${selected}/${g.maxSelect}`
              : `חובה ${range} · ${selected}/${g.maxSelect}`;
          }
        } else if (g.type === "multi") {
          if (unlimited) {
            subtitle = selected > 0
              ? (freeRemaining > 0
                  ? `נבחרו ${selected} · ${freeRemaining} חינם נותרו`
                  : `נבחרו ${selected}`)
              : (free > 0
                  ? `${free} הראשונים חינם · אפשר לבחור כמה שרוצים`
                  : "אפשר לבחור כמה שרוצים");
          } else if (atMax) {
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
            subtitle={withBundleNote(g, subtitle)}
            counter={
              g.type === "multi" && g.maxSelect > 1
                ? { selected, max: g.maxSelect, atMax, unlimited }
                : undefined
            }
            helpText={g.helpText}
            flash={flashGroupId === g.id}
          >
            {/* A group capped at one pick (single, or multi with maxSelect 1)
                behaves like a radio - one tap swaps the choice. */}
            {(() => {
              const isSingle = g.type === "single" || g.maxSelect === 1;
              return g.options.map((o) => {
              const checked = picks[g.id]?.has(o.id) ?? false;
              // `atMax` only blocks new picks for genuine multi-select groups
              // (maxSelect > 1). For radio groups the new tap always replaces
              // the current selection, so blocking the row would leave the
              // customer stuck on their first choice - the "can't switch" bug.
              const blocked = !isSingle && !checked && atMax;
              let priceLabel: string | null;
              if (o.priceDelta === 0) {
                priceLabel = null;
              } else if (o.priceDelta < 0) {
                priceLabel = `-${formatPrice(-o.priceDelta)}`;
              } else if (!hidePriceWhileFree) {
                priceLabel = `+${formatPrice(o.priceDelta)}`;
              } else if (checked) {
                const charged = groupCharges.get(o.id) ?? 0;
                priceLabel = charged > 0 ? `+${formatPrice(charged)}` : "חינם";
              } else {
                priceLabel = freeRemaining > 0 ? null : `+${formatPrice(o.priceDelta)}`;
              }
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
                  priceLabel={priceLabel}
                  priceTone="delta"
                  radio={isSingle}
                  stepper={
                    !isSingle && checked && g.allowQty
                      ? {
                          qty: optionQty(g, o.id),
                          canInc:
                            !atMax &&
                            (!o.maxQuantity || optionQty(g, o.id) < o.maxQuantity),
                          onInc: () => bumpOptionQty(g, o.id, 1),
                          onDec: () => bumpOptionQty(g, o.id, -1),
                        }
                      : undefined
                  }
                />
              );
            });
            })()}
          </Section>
        );
      })}

      {/* Kiosk: preset chips + on-screen keyboard. Web: plain textarea. */}
      <Section title="הערות" subtitle="אופציונלי">
        {kioskMode ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {KIOSK_NOTE_PRESETS.map((preset) => {
                const isActive = notes
                  .split(/\s*·\s*|\n/)
                  .map((s) => s.trim())
                  .includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const tokens = notes
                        .split(/\s*·\s*|\n/)
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const idx = tokens.indexOf(preset);
                      if (idx >= 0) tokens.splice(idx, 1);
                      else tokens.push(preset);
                      setNotes(tokens.join(" · "));
                    }}
                    className={cn(
                      "px-4 h-11 rounded-full text-base font-bold border-2 transition active:scale-95",
                      isActive
                        ? "bg-(--qf-primary) text-white border-(--qf-deep) shadow-[0_4px_14px_rgba(14,122,60,0.25)]"
                        : "bg-white text-qf-ink border-qf-line-soft hover:border-(--qf-primary)/40",
                    )}
                  >
                    {preset}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => onNotesKeyboard?.(notes, setNotes)}
                className="inline-flex items-center gap-1.5 px-4 h-11 rounded-full text-base font-bold bg-white text-(--qf-deep) border-2 border-(--qf-primary)/40 hover:bg-(--qf-soft) transition active:scale-95"
              >
                <IcoEdit c="currentColor" s={16} />
                כתבו הערה חופשית
              </button>
            </div>
            {notes && (
              <div className="bg-qf-line-soft/50 rounded-xl px-4 py-3 text-base text-qf-ink leading-relaxed">
                {notes}
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="הערות למנה"
            className="w-full bg-qf-bg border border-qf-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-(--qf-primary) focus:bg-white resize-none"
          />
        )}
      </Section>

      {/* Footer CTA - Wolt-style chunky pill with quantity stepper on one side
          and bold add-to-cart CTA on the other. `fixed` inside the modal
          pins to the transformed card (its containing block), so the bar
          floats over the scrolling options on every breakpoint and the
          live total stays visible. The full-page desktop route and the
          kiosk (inModal but NOT inside a transformed card - fixed there
          would pin to the viewport, across the category sidebar) keep the
          static bottom-of-card placement on lg+. In kioskMode we drop
          the max-w-md cap (the kiosk tablet was getting a cramped 448px
          bar centered in a 1000px viewport) and bump every tap target up
          so a fingertip on a 10" iPad lands clean. */}
      <div
        className={cn(
          "fixed bottom-0 inset-x-0 z-30",
          (!inModal || kioskMode) && "lg:static lg:inset-auto lg:mx-0 lg:z-auto",
          kioskMode
            ? "max-w-none mx-0 lg:max-w-none"
            : "max-w-md mx-auto lg:max-w-none",
        )}
      >
        <div
          className={cn(
            "bg-white border-t border-qf-line flex items-center",
            kioskMode
              ? "px-6 py-6 gap-5 lg:px-8 lg:py-7"
              : "px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] gap-3 lg:pb-4 lg:px-5",
          )}
        >
          <div
            className={cn(
              "flex items-center bg-qf-line-soft rounded-full",
              kioskMode && "shadow-sm",
            )}
          >
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className={cn(
                "grid place-items-center disabled:opacity-40 active:bg-qf-line-dash rounded-full transition",
                kioskMode ? "w-20 h-24" : "w-12 h-14",
              )}
              aria-label="הפחת"
            >
              <IcoMinus s={kioskMode ? 28 : 18} />
            </button>
            <div
              className={cn(
                "text-center font-bold tnum",
                kioskMode ? "w-14 text-3xl" : "w-8 text-base",
              )}
            >
              {quantity}
            </div>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
              disabled={quantity >= maxQty}
              className={cn(
                "grid place-items-center disabled:opacity-40 active:bg-qf-line-dash rounded-full transition",
                kioskMode ? "w-20 h-24" : "w-12 h-14",
              )}
              aria-label="הוסף"
            >
              <IcoPlus c="#11231a" s={kioskMode ? 28 : 18} />
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={addPhase !== "idle" || branchClosed || outOfStock}
            className={cn(
              "flex-1 font-bold flex items-center justify-between transition-all duration-300 active:scale-[0.98]",
              kioskMode
                ? "px-8 h-24 text-3xl rounded-3xl"
                : "px-5 h-14 text-base rounded-2xl",
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
                <span>{isEditing ? "מעדכן" : "מוסיף לסל"}</span>
                <span
                  className="qf-spinner"
                  style={{
                    width: kioskMode ? 32 : 20,
                    height: kioskMode ? 32 : 20,
                    borderWidth: 2.5,
                  }}
                />
              </>
            ) : (
              <>
                <span>{isEditing ? "עודכן" : "נוסף לסל"}</span>
                <IcoCheck c="#fff" s={kioskMode ? 32 : 20} className="animate-qf-check-in" />
              </>
            )}
          </button>
        </div>
      </div>

      {mounted && lightbox !== "closed" && heroImage && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={item.name}
          onClick={closeLightbox}
          className={cn(
            "fixed inset-0 z-[100] grid place-items-center bg-white cursor-zoom-out",
            lightbox === "open"
              ? "animate-qf-lightbox-fade"
              : "animate-qf-lightbox-fade-out",
          )}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            aria-label="סגור תמונה"
            className="absolute top-4 inset-s-4 z-10 w-10 h-10 rounded-full grid place-items-center bg-qf-line-soft text-qf-ink shadow-sm hover:bg-qf-line-dash transition"
          >
            <IcoClose s={16} c="currentColor" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={item.name}
            onClick={closeLightbox}
            className={cn(
              "max-w-full max-h-full w-auto h-auto object-contain select-none cursor-zoom-out",
              lightbox === "open"
                ? "animate-qf-lightbox-img-in"
                : "animate-qf-lightbox-img-out",
            )}
            draggable={false}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}

function HalfIcon({ side }: { side: HalfPlacement }) {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {side === "full" && <circle cx="8" cy="8" r="6.5" fill="currentColor" />}
      {side === "left" && (
        <path d="M 8 1.5 A 6.5 6.5 0 0 1 8 14.5 Z" fill="currentColor" />
      )}
      {side === "right" && (
        <path d="M 8 1.5 A 6.5 6.5 0 0 0 8 14.5 Z" fill="currentColor" />
      )}
    </svg>
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
  counter?: { selected: number; max: number; atMax: boolean; unlimited?: boolean };
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
          {counter && !(counter.unlimited && counter.selected === 0) && (
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
              {counter.unlimited ? counter.selected : `${counter.selected}/${counter.max}`}
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
  stepper,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  priceLabel: string | null;
  priceTone: "absolute" | "delta";
  radio?: boolean;
  imageUrl?: string | null;
  disabled?: boolean;
  stepper?: { qty: number; canInc: boolean; onInc: () => void; onDec: () => void };
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
      <span className="flex items-center gap-2.5 shrink-0">
        {priceLabel && (
          <span
            className={cn(
              "text-xs tnum font-medium",
              priceTone === "absolute" ? "text-qf-ink2" : "text-qf-mute",
            )}
          >
            {priceLabel}
          </span>
        )}
        {stepper && (
          <span
            className="flex items-center bg-qf-line-soft rounded-full"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              role="button"
              aria-label="הפחת"
              onClick={stepper.onDec}
              className="w-8 h-8 grid place-items-center rounded-full active:bg-qf-line-dash transition"
            >
              <IcoMinus s={14} />
            </span>
            <span className="w-5 text-center text-sm font-bold tnum">{stepper.qty}</span>
            <span
              role="button"
              aria-label="הוסף"
              onClick={stepper.canInc ? stepper.onInc : undefined}
              className={cn(
                "w-8 h-8 grid place-items-center rounded-full transition",
                stepper.canInc ? "active:bg-qf-line-dash" : "opacity-40",
              )}
            >
              <IcoPlus c="#11231a" s={14} />
            </span>
          </span>
        )}
      </span>
    </button>
  );
}
