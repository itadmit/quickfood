"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/customer/CartProvider";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";
import { IcoPlus, IcoMinus, IcoSearch, IcoClose, IcoChev } from "@/components/shared/Icons";
import { Utensils, ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MenuItemForCustomer } from "@/lib/menu-item-load";

interface KioskCategory {
  id: string;
  name: string;
}

interface KioskItem {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  artType: string | null;
  imageUrl: string | null;
  tags: string[];
  categoryId: string;
  featured: boolean;
}

export function KioskApp({
  tenantSlug,
  tenantName,
  logoUrl,
  coverImage,
  welcomeText,
  idleSeconds,
  businessType: businessTypeProp,
  featuredBadgeLabel,
  categories,
  upsellCategoryIds,
  items,
  itemDetails,
}: {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  coverImage: string | null;
  welcomeText: string | null;
  idleSeconds: number;
  businessType: string;
  featuredBadgeLabel: string | null;
  categories: KioskCategory[];
  upsellCategoryIds: string[];
  items: KioskItem[];
  itemDetails: Record<string, MenuItemForCustomer>;
}) {
  const featuredLabel = featuredBadgeLabel?.trim() || "מומלץ של השף";
  const { lines, subtotal, clear, updateQuantity, remove, add, tenant } = useCart();
  const [state, setState] = useState<"start" | "mode" | "browse" | "placing" | "thanks">("start");
  const [diningMode, setDiningMode] = useState<"dinein" | "takeaway" | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? "");
  const [pickItemId, setPickItemId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null);
  const [placingError, setPlacingError] = useState<string | null>(null);

  // The customer layout below us renders top nav, FAB, preview bar etc.
  // Cover the lot with a full-viewport overlay so the kiosk reads as a
  // single-purpose appliance, not "the storefront in disguise". Body
  // scroll is locked too — touching the back of the chrome shouldn't
  // pull the kiosk content around.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const businessType =
    (tenant.businessType as BusinessType) ?? (businessTypeProp as BusinessType) ?? "general";

  // Every item's full sizes + option groups arrived in the initial
  // server render (itemDetails prop), so the picker opens instantly
  // — no skeleton, no network round-trip. Kiosks have to feel native.
  const pickedItemData = pickItemId ? itemDetails[pickItemId] : null;

  // Idle reset. After idleSeconds of zero touch/click/key the kiosk
  // wipes the cart, closes any open picker, and returns to the start
  // screen — the next customer should never inherit the previous
  // person's half-built order. Five-second polling is fine; we don't
  // need millisecond accuracy.
  const lastActivityRef = useRef(Date.now());
  const reset = useCallback(() => {
    clear();
    setPickItemId(null);
    setQuery("");
    setActiveCat(categories[0]?.id ?? "");
    setState("start");
    setDiningMode(null);
    setCartOpen(false);
    setPlacedOrderNumber(null);
    setPlacingError(null);
  }, [clear, categories]);

  useEffect(() => {
    function touch() {
      lastActivityRef.current = Date.now();
    }
    const evts: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    for (const e of evts) window.addEventListener(e, touch);
    return () => {
      for (const e of evts) window.removeEventListener(e, touch);
    };
  }, []);

  useEffect(() => {
    if (state === "start") return;
    const handle = window.setInterval(() => {
      const idle = (Date.now() - lastActivityRef.current) / 1000;
      if (idle >= idleSeconds) reset();
    }, 5000);
    return () => window.clearInterval(handle);
  }, [state, idleSeconds, reset]);

  // After successful order: hold the thank-you screen for 6s then reset.
  useEffect(() => {
    if (state !== "thanks") return;
    const t = window.setTimeout(reset, 6000);
    return () => window.clearTimeout(t);
  }, [state, reset]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items;
    if (q) list = list.filter((it) => it.name.toLowerCase().includes(q));
    else if (activeCat) list = list.filter((it) => it.categoryId === activeCat);
    return list;
  }, [items, query, activeCat]);

  // Upsell suggestions inside the cart sheet — drinks / desserts from
  // the categories the merchant flagged as upsellInCart. Excludes
  // items already in the cart so we don't pitch a drink the customer
  // just picked, and picks the cheapest 4 so the screen stays tidy.
  // The per-item needsConfig is computed from the preloaded item data
  // so we can route the "+" tap straight to addToCart when there's
  // nothing to configure.
  const upsellSuggestions = useMemo(() => {
    if (upsellCategoryIds.length === 0) return [] as Array<KioskItem & { needsConfig: boolean }>;
    const inCart = new Set(lines.map((l) => l.itemId));
    const upsellSet = new Set(upsellCategoryIds);
    return items
      .filter((it) => upsellSet.has(it.categoryId) && !inCart.has(it.id))
      .map((it) => {
        const detail = itemDetails[it.id];
        const hasMultipleSizes = (detail?.sizes?.length ?? 0) > 1;
        const hasRequiredGroup = (detail?.optionGroups ?? []).some(
          (g) => g.required === true,
        );
        return { ...it, needsConfig: hasMultipleSizes || hasRequiredGroup };
      })
      .sort((a, b) => a.basePrice - b.basePrice)
      .slice(0, 4);
  }, [items, itemDetails, lines, upsellCategoryIds]);

  function quickAddUpsell(it: KioskItem & { needsConfig: boolean }) {
    if (it.needsConfig) {
      setCartOpen(false);
      setPickItemId(it.id);
      return;
    }
    add({
      itemId: it.id,
      name: it.name,
      basePrice: it.basePrice,
      artType: it.artType,
      imageUrl: it.imageUrl,
      quantity: 1,
      sizeId: null,
      sizeName: null,
      sizeDelta: 0,
      options: [],
      notes: null,
      source: "upsell",
    });
  }

  async function placeOrder() {
    setState("placing");
    setPlacingError(null);
    try {
      // Kiosk orders all run on method=pickup (no delivery). The
      // dinein/takeaway split is surfaced to the kitchen via the
      // customer_notes prefix so it lands on the Kanban card and the
      // thermal receipt without a schema change.
      const diningNote =
        diningMode === "dinein" ? "קיוסק · לשבת במסעדה" : "קיוסק · לקחת";
      const res = await fetch("/api/v1/customer/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          method: "pickup",
          payment_method: "cash",
          source: "direct",
          customer_notes: diningNote,
          lines: lines.map((l) => ({
            item_id: l.itemId,
            quantity: l.quantity,
            size_id: l.sizeId,
            option_ids: l.options.map((o) => o.optionId),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlacingError(data?.error?.message ?? "יצירת ההזמנה נכשלה");
        setState("browse");
        return;
      }
      setPlacedOrderNumber(data?.order?.number ?? null);
      setState("thanks");
    } catch {
      setPlacingError("שגיאת רשת. נסי שוב.");
      setState("browse");
    }
  }

  // ─── Start screen ──────────────────────────────────────────────
  if (state === "start") {
    return (
      <button
        type="button"
        onClick={() => setState("mode")}
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-10 p-12 text-center select-none cursor-pointer overflow-hidden"
        style={
          coverImage
            ? {
                backgroundImage: `url(${coverImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { background: "var(--qf-bg)" }
        }
        aria-label="התחל הזמנה חדשה"
      >
        {/* Dark scrim over the cover so the white headline + chrome
            stay readable on any photo. No scrim when there's no cover
            so the qf-bg surface shows clean. */}
        {coverImage && (
          <div aria-hidden className="absolute inset-0 bg-black/55" />
        )}
        <div
          className={cn(
            "relative z-10 flex flex-col items-center gap-10",
            coverImage ? "text-white" : "text-qf-ink",
          )}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="w-32 h-32 rounded-3xl object-contain bg-white/90 p-2 shadow-2xl" />
          ) : (
            <div className="w-32 h-32 rounded-3xl bg-(--qf-primary) text-white grid place-items-center font-black text-5xl shadow-2xl">
              {tenantName.slice(0, 1)}
            </div>
          )}
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-5xl font-black leading-tight drop-shadow-lg">
              {welcomeText?.trim() || `ברוכים הבאים ל-${tenantName}`}
            </h1>
            <p className={cn("text-2xl", coverImage ? "text-white/85" : "text-qf-ink2")}>
              הקישו על המסך כדי להזמין
            </p>
          </div>
          <span
            className="px-16 py-7 rounded-3xl bg-(--qf-primary) text-white text-3xl font-black shadow-2xl"
          >
            הזמנה חדשה
          </span>
        </div>
      </button>
    );
  }

  // ─── Mode picker (dine-in / takeaway) ─────────────────────────
  if (state === "mode") {
    return (
      <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col select-none">
        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-qf-line-soft bg-white">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={tenantName} className="w-12 h-12 rounded-xl object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-(--qf-primary) text-white grid place-items-center font-black text-xl">
                {tenantName.slice(0, 1)}
              </div>
            )}
            <h1 className="text-2xl font-black text-qf-ink">{tenantName}</h1>
          </div>
          <button
            type="button"
            onClick={reset}
            className="px-5 py-3 rounded-xl border-2 border-qf-line-dash text-qf-mute hover:text-qf-ink hover:border-qf-ink/40 text-lg font-medium"
          >
            ביטול
          </button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-12 p-12 text-center">
          <h2 className="text-5xl font-black text-qf-ink">איך נהנים מהארוחה?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
            <button
              type="button"
              onClick={() => {
                setDiningMode("dinein");
                setState("browse");
              }}
              className="bg-white border-4 border-qf-line-dash hover:border-(--qf-primary) rounded-3xl p-10 flex flex-col items-center gap-5 active:scale-[0.98] transition shadow-lg"
            >
              <Utensils size={72} strokeWidth={1.6} className="text-(--qf-primary)" aria-hidden />
              <span className="text-3xl font-black text-qf-ink">לשבת במסעדה</span>
              <span className="text-base text-qf-mute">אוכל בצלחת + סכו״ם</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDiningMode("takeaway");
                setState("browse");
              }}
              className="bg-white border-4 border-qf-line-dash hover:border-(--qf-primary) rounded-3xl p-10 flex flex-col items-center gap-5 active:scale-[0.98] transition shadow-lg"
            >
              <ShoppingBag size={72} strokeWidth={1.6} className="text-(--qf-primary)" aria-hidden />
              <span className="text-3xl font-black text-qf-ink">לקחת</span>
              <span className="text-base text-qf-mute">ארוז לדרך</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Thanks screen ─────────────────────────────────────────────
  if (state === "thanks") {
    return (
      <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col items-center justify-center gap-8 p-12 text-center select-none">
        <div className="w-32 h-32 rounded-full bg-qf-green-soft grid place-items-center">
          <span className="text-7xl text-qf-green-deep" aria-hidden>
            ✓
          </span>
        </div>
        <div className="space-y-3 max-w-2xl">
          <h1 className="text-5xl font-black text-qf-ink">ההזמנה התקבלה</h1>
          {placedOrderNumber && (
            <p className="text-3xl font-bold tnum text-qf-ink2">#{placedOrderNumber}</p>
          )}
          <p className="text-xl text-qf-mute">תוכלו לשלם בקופה. בתאבון!</p>
        </div>
      </div>
    );
  }

  // ─── Browse + cart ─────────────────────────────────────────────
  const itemCount = lines.reduce((acc, l) => acc + l.quantity, 0);
  return (
    <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col select-none">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-qf-line-soft bg-white">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={tenantName} className="w-12 h-12 rounded-xl object-contain shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-(--qf-primary) text-white grid place-items-center font-black text-xl shrink-0">
              {tenantName.slice(0, 1)}
            </div>
          )}
          <h1 className="text-2xl font-black text-qf-ink truncate">{tenantName}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {diningMode && (
            <button
              type="button"
              onClick={() => setState("mode")}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-(--qf-soft) text-(--qf-deep) text-base font-bold hover:bg-(--qf-primary)/15 transition"
              aria-label="שינוי בחירת ישיבה/לקיחה"
            >
              {diningMode === "dinein" ? (
                <Utensils size={18} strokeWidth={2.2} aria-hidden />
              ) : (
                <ShoppingBag size={18} strokeWidth={2.2} aria-hidden />
              )}
              {diningMode === "dinein" ? "לשבת" : "לקחת"}
            </button>
          )}
          <button
            type="button"
            onClick={reset}
            className="px-5 py-3 rounded-xl border-2 border-qf-line-dash text-qf-mute hover:text-qf-ink hover:border-qf-ink/40 text-lg font-medium"
          >
            התחל מחדש
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 pb-24">
        {/* Side category nav. Vertical list, large touch targets,
            collapsed scroll. Hidden when a search query is active —
            the search results span every category anyway. */}
        {!query && categories.length > 0 && (
          <nav className="w-56 lg:w-64 shrink-0 border-e border-qf-line-soft bg-white overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {categories.map((c) => {
                const active = activeCat === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setActiveCat(c.id)}
                      className={cn(
                        "w-full text-right px-4 py-4 rounded-xl text-lg font-bold transition",
                        active
                          ? "bg-(--qf-primary) text-white shadow-md"
                          : "bg-transparent text-qf-ink hover:bg-qf-line-soft",
                      )}
                    >
                      {c.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="חיפוש בתפריט"
                className="w-full ps-14 pe-4 py-4 rounded-2xl border-2 border-qf-line-dash text-xl bg-white focus:border-(--qf-primary) outline-none"
              />
              <span className="absolute inset-s-4 top-1/2 -translate-y-1/2 text-qf-mute">
                <IcoSearch c="#7c8a82" s={22} />
              </span>
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute inset-e-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg hover:bg-qf-line-soft grid place-items-center text-qf-mute"
                  aria-label="נקה חיפוש"
                >
                  <IcoClose s={18} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filtered.length === 0 && (
                <div className="col-span-full text-center text-qf-mute text-lg py-12">
                  {query ? `לא נמצאו פריטים עבור "${query}"` : "אין פריטים בקטגוריה הזו"}
                </div>
              )}
              {filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setPickItemId(it.id)}
                  className="bg-white border-2 border-qf-line-dash rounded-2xl overflow-hidden text-right hover:border-(--qf-primary) transition active:scale-[0.98] relative"
                >
                  {it.featured && (
                    <span
                      className="absolute top-0 start-0 z-10 bg-(--qf-primary) text-white text-xs font-black px-3 py-1.5 rounded-se-2xl rounded-es-2xl shadow"
                      aria-label={featuredLabel}
                    >
                      {featuredLabel}
                    </span>
                  )}
                  <div className="aspect-square bg-qf-line-soft relative">
                    <MenuItemImage
                      src={it.imageUrl ?? undefined}
                      alt={it.name}
                      businessType={businessType}
                      size={320}
                      rounded="none"
                      fill
                    />
                  </div>
                  <div className="p-3">
                    <div className="text-lg font-bold leading-tight line-clamp-2 min-h-[2.6em]">{it.name}</div>
                    <div className="text-base text-qf-mute mt-2 tnum">{formatPrice(it.basePrice)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Cart sticky bar — collapsed by default so the menu owns the
          screen. Tap opens the cart sheet for review + place-order. */}
      <button
        type="button"
        onClick={() => itemCount > 0 && setCartOpen(true)}
        disabled={itemCount === 0}
        className={cn(
          "fixed bottom-0 inset-x-0 z-30 flex items-center justify-between gap-4 px-6 py-4 text-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)] transition disabled:opacity-90 disabled:cursor-default",
          itemCount > 0 ? "bg-(--qf-primary) active:scale-[0.99]" : "bg-qf-mute",
        )}
        aria-label={itemCount > 0 ? "פתח עגלה" : "העגלה ריקה"}
      >
        <span className="text-xl font-black">
          {itemCount === 0 ? "הוסיפו פריט כדי להזמין" : `העגלה · ${itemCount} ${itemCount === 1 ? "פריט" : "פריטים"}`}
        </span>
        {itemCount > 0 && (
          <span className="text-2xl font-black tnum">{formatPrice(subtotal)}</span>
        )}
      </button>

      {/* Cart sheet overlay */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setCartOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] animate-qf-sheet-in"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-6 py-4 border-b border-qf-line-soft flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-qf-mute tracking-wider">ההזמנה שלך</div>
                <div className="text-2xl font-black mt-1">
                  {itemCount} {itemCount === 1 ? "פריט" : "פריטים"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="w-12 h-12 rounded-xl hover:bg-qf-line-soft grid place-items-center"
                aria-label="סגור"
              >
                <IcoClose s={20} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {lines.length === 0 ? (
                <div className="text-center text-qf-mute text-base py-10">הסל ריק</div>
              ) : (
                lines.map((l) => {
                  const lineTotal =
                    (l.basePrice +
                      l.sizeDelta +
                      l.options.reduce((a, o) => a + o.priceDelta, 0)) *
                    l.quantity;
                  return (
                    <div key={l.lineId} className="bg-qf-line-soft/40 rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-lg font-bold">{l.name}</div>
                          {l.sizeName && (
                            <div className="text-sm text-qf-mute">{l.sizeName}</div>
                          )}
                          {l.options.length > 0 && (
                            <div className="text-sm text-qf-mute">
                              {l.options.map((o) => o.name).join(" · ")}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(l.lineId)}
                          className="text-qf-mute hover:text-qf-tomato text-2xl px-2"
                          aria-label="הסר"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center bg-white rounded-full border-2 border-qf-line-dash">
                          <button
                            type="button"
                            onClick={() => updateQuantity(l.lineId, Math.max(1, l.quantity - 1))}
                            disabled={l.quantity <= 1}
                            className="w-12 h-12 grid place-items-center disabled:opacity-40 text-xl"
                            aria-label="הפחת"
                          >
                            <IcoMinus s={18} />
                          </button>
                          <div className="w-10 text-center text-lg font-bold tnum">{l.quantity}</div>
                          <button
                            type="button"
                            onClick={() => updateQuantity(l.lineId, Math.min(20, l.quantity + 1))}
                            disabled={l.quantity >= 20}
                            className="w-12 h-12 grid place-items-center disabled:opacity-40 text-xl"
                            aria-label="הוסף"
                          >
                            <IcoPlus c="#11231a" s={18} />
                          </button>
                        </div>
                        <div className="text-xl font-black tnum">{formatPrice(lineTotal)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {upsellSuggestions.length > 0 && lines.length > 0 && (
              <div className="border-t border-qf-line-soft px-5 py-4 bg-qf-line-soft/30">
                <div className="text-sm font-bold text-qf-mute mb-2">להוסיף משהו?</div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {upsellSuggestions.map((it) => (
                    <div
                      key={it.id}
                      className="shrink-0 w-32 bg-white border border-qf-line-dash rounded-xl overflow-hidden text-right relative"
                    >
                      <div className="aspect-square bg-qf-line-soft relative">
                        <MenuItemImage
                          src={it.imageUrl ?? undefined}
                          alt={it.name}
                          businessType={businessType}
                          size={140}
                          rounded="none"
                          fill
                        />
                      </div>
                      <div className="p-2">
                        <div className="text-xs font-bold leading-tight line-clamp-2 min-h-[2.4em]">
                          {it.name}
                        </div>
                        <div className="text-xs text-qf-mute tnum mt-1">
                          {formatPrice(it.basePrice)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => quickAddUpsell(it)}
                        aria-label={it.needsConfig ? `הוסף ${it.name} (יש בחירות)` : `הוסף ${it.name} לסל`}
                        className="absolute top-2 start-2 w-9 h-9 rounded-full bg-(--qf-primary) text-white shadow-md grid place-items-center hover:bg-(--qf-deep) active:scale-95 transition"
                      >
                        <IcoPlus c="#fff" s={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <footer className="px-6 py-5 border-t border-qf-line-soft space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-lg text-qf-mute">סה״כ</span>
                <span className="text-4xl font-black tnum">{formatPrice(subtotal)}</span>
              </div>
              {placingError && (
                <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-lg px-3 py-2">
                  {placingError}
                </div>
              )}
              <button
                type="button"
                onClick={placeOrder}
                disabled={lines.length === 0 || state === "placing"}
                className="w-full py-6 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-2xl font-black disabled:opacity-50 shadow-lg active:scale-[0.98] transition"
              >
                {state === "placing" ? "שולח..." : "להזמין · תשלום בקופה"}
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="w-full py-3 rounded-2xl border-2 border-qf-line-dash text-qf-ink text-lg font-medium"
              >
                המשך לקנות
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Item picker: full-page overlay instead of a floating modal —
          kiosk hands shouldn't have to aim at a Close-X in the corner.
          A wide "חזרה לתפריט" bar at the top, content scrolls naturally
          to the existing footer CTA from ItemDetail itself. */}
      {pickItemId && (
        <div className="fixed inset-0 z-50 bg-qf-bg flex flex-col">
          <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-qf-line-soft bg-white shrink-0">
            <button
              type="button"
              onClick={() => setPickItemId(null)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-qf-line-dash text-qf-ink text-lg font-bold hover:bg-qf-line-soft transition"
            >
              <IcoChev s={20} />
              חזרה לתפריט
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-5 py-3 rounded-xl text-qf-mute hover:text-qf-ink text-base"
            >
              ביטול הזמנה
            </button>
          </header>
          <div className="flex-1 overflow-y-auto">
            {pickedItemData ? (
              <ItemDetail
                tenantSlug={tenantSlug}
                businessType={businessType as never}
                item={pickedItemData as never}
                inModal
                onClose={() => setPickItemId(null)}
                addSource="menu"
              />
            ) : (
              <div className="p-10 text-center text-qf-mute">פריט לא נמצא</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
