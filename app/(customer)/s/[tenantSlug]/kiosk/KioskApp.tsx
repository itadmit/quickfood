"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/customer/CartProvider";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { ItemDetailModal } from "@/components/customer/ItemDetailModal";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";
import ItemModalSkeleton from "@/components/customer/ItemModalSkeleton";
import { IcoPlus, IcoMinus, IcoSearch, IcoClose } from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

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
}

export function KioskApp({
  tenantSlug,
  tenantName,
  logoUrl,
  coverImage,
  welcomeText,
  idleSeconds,
  categories,
  items,
}: {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  coverImage: string | null;
  welcomeText: string | null;
  idleSeconds: number;
  categories: KioskCategory[];
  items: KioskItem[];
}) {
  const { lines, subtotal, clear, updateQuantity, remove, tenant } = useCart();
  const [state, setState] = useState<"start" | "browse" | "placing" | "thanks">("start");
  const [cartOpen, setCartOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? "");
  const [pickItemId, setPickItemId] = useState<string | null>(null);
  const [itemData, setItemData] = useState<null | { item: Record<string, unknown>; tenant: { slug: string; businessType: string } }>(null);
  const [itemLoading, setItemLoading] = useState(false);
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

  const businessType = (tenant.businessType as BusinessType) ?? "general";

  // Item-detail modal: same component the storefront uses, so themed
  // colors / RTL / option groups / half-and-half all behave identically.
  useEffect(() => {
    if (!pickItemId) {
      setItemData(null);
      return;
    }
    setItemLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/v1/customer/menu-item?slug=${tenantSlug}&id=${encodeURIComponent(pickItemId)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.item) setItemData(d);
      })
      .catch(() => {})
      .finally(() => setItemLoading(false));
    return () => ctrl.abort();
  }, [pickItemId, tenantSlug]);

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

  async function placeOrder() {
    setState("placing");
    setPlacingError(null);
    try {
      const res = await fetch("/api/v1/customer/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_slug: tenantSlug,
          method: "pickup",
          payment_method: "cash",
          source: "direct",
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
        onClick={() => setState("browse")}
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
          התחל מחדש
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6 pb-32">
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

          {!query && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCat(c.id)}
                  className={cn(
                    "px-5 py-3 rounded-full text-lg whitespace-nowrap border-2 transition",
                    activeCat === c.id
                      ? "bg-(--qf-primary) text-white border-transparent font-bold"
                      : "bg-white border-qf-line-dash text-qf-ink2",
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

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
                className="bg-white border-2 border-qf-line-dash rounded-2xl overflow-hidden text-right hover:border-(--qf-primary) transition active:scale-[0.98]"
              >
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

      {pickItemId && (
        <ItemDetailModal onClose={() => setPickItemId(null)}>
          {itemLoading || !itemData ? (
            <ItemModalSkeleton />
          ) : (
            <ItemDetail
              tenantSlug={tenantSlug}
              businessType={(itemData.tenant as { businessType: string }).businessType as never}
              item={itemData.item as never}
              inModal
              onClose={() => setPickItemId(null)}
              addSource="menu"
            />
          )}
        </ItemDetailModal>
      )}
    </div>
  );
}
