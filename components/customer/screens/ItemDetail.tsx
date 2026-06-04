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
  tags: string[];
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
  /** Rendered inside the kiosk overlay — drops the mobile-narrow
   *  max-w-md cap on the footer CTA and bumps touch targets so the
   *  bar actually feels tappable on a 10–13" tablet in landscape. */
  kioskMode?: boolean;
  // Kiosk: invoked when "כתבו הערה חופשית" is tapped so the parent can
  // mount its on-screen Hebrew keyboard bound to the notes value.
  onNotesKeyboard?: (current: string, set: (next: string) => void) => void;
  onClose?: () => void;
  editLine?: CartLine;
  /** Provenance tag attached to the cart line when this detail screen
   *  results in a new add. Defaults to "menu" — override from CartUpsell,
   *  AI flows, reorder rails, etc. */
  addSource?: CartLineSource;
}) {
  const router = useRouter();
  const { add, updateLine, tenant } = useCart();
  const isEditing = !!editLine;
  const upsellSizeNudge = tenant.upsellSizeNudge !== false;

  const defaultSize = item.sizes.find((s) => s.isDefault) ?? item.sizes[0] ?? null;
  const [sizeId, setSizeId] = useState<string | null>(editLine?.sizeId ?? defaultSize?.id ?? null);

  const [picks, setPicks] = useState<Record<string, Set<string>>>(() => {
    const initial: Record<string, Set<string>> = {};
    if (editLine) {
      // Pre-populate from the existing cart line. Half-and-half picks
      // live in the `half` field, so they go in halfPicks below — here
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

  // Favorite state. Asked once on mount via the existing
  // /api/v1/customer/favorites GET (filtered to this tenant). Guest
  // sessions return 401 and we silently leave the heart unfilled — the
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

  const heroImage = item.images?.[0];
  const canZoom = !!heroImage;

  const closeTimerRef = useRef<number | null>(null);
  function openLightbox() {
    if (!canZoom) return;
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

  const total = useMemo(() => {
    const size = item.sizes.find((s) => s.id === sizeId);
    const sDelta = size?.priceDelta ?? 0;
    let oDelta = 0;
    for (const g of item.optionGroups) {
      if (g.allowHalf) {
        const gHalf = halfPicks[g.id] ?? {};
        const picked = g.options.filter((o) => gHalf[o.id]);
        // Mirror server: free slots applied to the cheapest PAID picks
        // (by full priceDelta), then any survivor gets halved if its
        // placement is not "full".
        const paidSorted = picked
          .filter((o) => o.priceDelta > 0)
          .sort((a, b) => a.priceDelta - b.priceDelta);
        const free = g.includedFree ?? 0;
        const freedIds = new Set(paidSorted.slice(0, free).map((o) => o.id));
        for (const o of picked) {
          const placement = gHalf[o.id];
          const baseDelta = freedIds.has(o.id) ? 0 : o.priceDelta;
          const delta = placement !== "full" ? Math.round(baseDelta / 2) : baseDelta;
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
      // A group marked חובה must always require at least one pick — even
      // if the catalog's minSelect leaked through as 0 (a known artefact
      // of the Wolt importer that doesn't always seed the floor).
      const floor = g.required ? Math.max(1, g.minSelect) : g.minSelect;
      if (g.allowHalf) {
        const count = Object.keys(halfPicks[g.id] ?? {}).length;
        if (g.required && count < floor) return g;
      } else {
        const sel = picks[g.id] ?? new Set();
        if (g.required && sel.size < floor) return g;
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
      if (g.allowHalf) {
        const gHalf = halfPicks[g.id] ?? {};
        const picked = g.options.filter((o) => gHalf[o.id]);
        const paidSorted = picked
          .filter((o) => o.priceDelta > 0)
          .sort((a, b) => a.priceDelta - b.priceDelta);
        const free = g.includedFree ?? 0;
        const freedIds = new Set(paidSorted.slice(0, free).map((o) => o.id));
        for (const o of picked) {
          const placement = gHalf[o.id]!;
          const baseDelta = freedIds.has(o.id) ? 0 : o.priceDelta;
          const effectiveDelta = placement !== "full" ? Math.round(baseDelta / 2) : baseDelta;
          selectedOpts.push({ groupId: g.id, optionId: o.id, name: o.name, groupName: g.name, priceDelta: effectiveDelta, half: placement });
        }
      } else {
        const sel = picks[g.id] ?? new Set();
        const picked = g.options.filter((o) => sel.has(o.id));
        const free = g.includedFree ?? 0;
        const paidSorted = picked.filter((o) => o.priceDelta > 0).sort((a, b) => a.priceDelta - b.priceDelta);
        const freedIds = new Set(paidSorted.slice(0, free).map((o) => o.id));
        for (const o of picked) {
          const effectiveDelta = freedIds.has(o.id) ? 0 : o.priceDelta;
          selectedOpts.push({ groupId: g.id, optionId: o.id, name: o.name, groupName: g.name, priceDelta: effectiveDelta });
        }
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

  const ctaLabel = missingGroup
    ? `בחר ${missingGroup.name}`
    : isEditing
      ? "עדכן הזמנה"
      : "הוסף לסל";

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
        {canZoom ? (
          <button
            type="button"
            onClick={openLightbox}
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
                className="mt-2 mx-5 lg:mx-0 block w-[calc(100%-2.5rem)] lg:w-full rounded-2xl border-2 border-(--qf-primary) bg-(--qf-soft) p-4 text-start hover:bg-(--qf-primary)/15 transition active:scale-[0.99]"
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
                      שדרגו ל-{upgradeTo.name} ב-+{formatPrice(upgradeDelta)} בלבד
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
              : counterLabel ?? `חובה ${minHalf}–${g.maxSelect} · ${totalDistinct}/${g.maxSelect}`
            : atMax
              ? counterLabel ?? `הגעת למקסימום · ${g.maxSelect}/${g.maxSelect}`
              : counterLabel ?? `אפשר לבחור עד ${g.maxSelect} · כל תוספת ניתן לקבוע לחצי פיצה`;

          return (
            <Section
              key={g.id}
              id={`group-${g.id}`}
              title={g.name}
              required={g.required}
              subtitle={subtitle}
              counter={sectionMax > 1 ? { selected, max: sectionMax, atMax } : undefined}
              helpText={g.helpText}
              flash={flashGroupId === g.id}
            >
              {g.options.map((o) => {
                const placement = gHalf[o.id] as HalfPlacement | undefined;
                const halfPrice = Math.round(o.priceDelta / 2);

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
                          {`שלם +${formatPrice(o.priceDelta)} · חצי +${formatPrice(halfPrice)}`}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(["left", "full", "right"] as HalfPlacement[]).map((p) => {
                        const buttonBlocked = rowBlocked
                          ? placement !== p
                          : wouldExceed(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            disabled={buttonBlocked}
                            onClick={() => { if (!buttonBlocked) toggleHalf(g, o.id, p); }}
                            className={cn(
                              "h-8 px-2.5 rounded-lg text-xs font-semibold border transition",
                              placement === p
                                ? "bg-(--qf-primary) border-(--qf-primary) text-white"
                                : "bg-white border-qf-line text-qf-ink2 hover:border-(--qf-primary) hover:text-(--qf-primary)",
                              buttonBlocked && "opacity-40 cursor-not-allowed",
                            )}
                          >
                            {p === "left" ? "חצי א׳" : p === "right" ? "חצי ב׳" : "שלם"}
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
        const selected = picks[g.id]?.size ?? 0;
        const remaining = Math.max(0, g.maxSelect - selected);
        const atMax = selected >= g.maxSelect;
        const freeRemaining = Math.max(0, free - selected);

        let subtitle: string;
        if (g.required) {
          const effectiveMin = Math.max(1, g.minSelect);
          if (g.type === "single") {
            subtitle = selected > 0 ? "נבחר" : "חובה לבחור 1";
          } else {
            const range =
              effectiveMin === g.maxSelect
                ? `${effectiveMin}`
                : `${effectiveMin}–${g.maxSelect}`;
            subtitle = selected >= effectiveMin
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
              // `atMax` only blocks new picks for MULTI groups. For
              // single-select (radio) the new tap always replaces the
              // current selection, so blocking the row would leave the
              // customer stuck on their first choice with no way back —
              // exactly the "selected one, can't switch" bug.
              const blocked = g.type === "multi" && !checked && atMax;
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
            placeholder="למשל: בלי בצל, חתוך ל-8"
            className="w-full bg-qf-bg border border-qf-line rounded-xl px-3 py-2.5 text-sm outline-none focus:border-(--qf-primary) focus:bg-white resize-none"
          />
        )}
      </Section>

      {/* Footer CTA — Wolt-style chunky pill with quantity stepper on one side
          and bold add-to-cart CTA on the other. Sticks to viewport on mobile,
          sits naturally at the bottom of the card on desktop. In kioskMode
          we drop the max-w-md cap (the kiosk tablet was getting a cramped
          448px-wide bar centered in a 1000px viewport) and bump every
          tap target up so a fingertip on a 10" iPad lands clean. */}
      <div
        className={cn(
          "fixed bottom-0 inset-x-0 z-30 lg:static lg:inset-auto lg:mx-0 lg:z-auto",
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
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              disabled={quantity >= 20}
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
            disabled={addPhase !== "idle"}
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
