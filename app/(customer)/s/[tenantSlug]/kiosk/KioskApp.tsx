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
  welcomeText,
  idleSeconds,
  categories,
  items,
}: {
  tenantSlug: string;
  tenantName: string;
  logoUrl: string | null;
  welcomeText: string | null;
  idleSeconds: number;
  categories: KioskCategory[];
  items: KioskItem[];
}) {
  const { lines, subtotal, clear, updateQuantity, remove, tenant } = useCart();
  const [state, setState] = useState<"start" | "browse" | "placing" | "thanks">("start");
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
      <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col items-center justify-center gap-10 p-12 text-center select-none">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={tenantName} className="w-32 h-32 rounded-3xl object-contain" />
        ) : (
          <div className="w-32 h-32 rounded-3xl bg-(--qf-primary) text-white grid place-items-center font-black text-5xl">
            {tenantName.slice(0, 1)}
          </div>
        )}
        <div className="space-y-4 max-w-2xl">
          <h1 className="text-5xl font-black text-qf-ink leading-tight">
            {welcomeText?.trim() || `ברוכים הבאים ל-${tenantName}`}
          </h1>
          <p className="text-2xl text-qf-ink2">הקישו על המסך כדי להזמין</p>
        </div>
        <button
          type="button"
          onClick={() => setState("browse")}
          className="px-16 py-7 rounded-3xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-3xl font-black shadow-2xl active:scale-95 transition"
        >
          הזמנה חדשה
        </button>
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

      <div className="flex-1 flex min-h-0">
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

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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

        <aside className="w-96 border-s border-qf-line-soft bg-white flex flex-col">
          <div className="px-5 py-4 border-b border-qf-line-soft">
            <div className="text-xs font-black text-qf-mute tracking-wider">ההזמנה שלך</div>
            <div className="text-2xl font-black mt-1">
              {lines.length} {lines.length === 1 ? "פריט" : "פריטים"}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {lines.length === 0 ? (
              <div className="text-center text-qf-mute text-base py-10">
                הסל ריק. הקישו על פריט כדי להוסיף.
              </div>
            ) : (
              lines.map((l) => {
                const lineTotal = (l.basePrice + l.sizeDelta + l.options.reduce((a, o) => a + o.priceDelta, 0)) * l.quantity;
                return (
                  <div key={l.lineId} className="bg-qf-line-soft/50 rounded-xl p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-bold truncate">{l.name}</div>
                        {l.sizeName && (
                          <div className="text-xs text-qf-mute truncate">{l.sizeName}</div>
                        )}
                        {l.options.length > 0 && (
                          <div className="text-xs text-qf-mute truncate">
                            {l.options.map((o) => o.name).join(" · ")}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(l.lineId)}
                        className="text-qf-mute hover:text-qf-tomato text-xl px-1"
                        aria-label="הסר"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center bg-white rounded-full border border-qf-line-dash">
                        <button
                          type="button"
                          onClick={() => updateQuantity(l.lineId, Math.max(1, l.quantity - 1))}
                          disabled={l.quantity <= 1}
                          className="w-9 h-9 grid place-items-center disabled:opacity-40"
                          aria-label="הפחת"
                        >
                          <IcoMinus s={14} />
                        </button>
                        <div className="w-8 text-center text-sm font-bold tnum">{l.quantity}</div>
                        <button
                          type="button"
                          onClick={() => updateQuantity(l.lineId, Math.min(20, l.quantity + 1))}
                          disabled={l.quantity >= 20}
                          className="w-9 h-9 grid place-items-center disabled:opacity-40"
                          aria-label="הוסף"
                        >
                          <IcoPlus c="#11231a" s={14} />
                        </button>
                      </div>
                      <div className="text-base font-bold tnum">{formatPrice(lineTotal)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-5 py-4 border-t border-qf-line-soft space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-base text-qf-mute">סה״כ</span>
              <span className="text-3xl font-black tnum">{formatPrice(subtotal)}</span>
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
              className="w-full py-5 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xl font-black disabled:opacity-50 shadow-lg active:scale-[0.98] transition"
            >
              {state === "placing" ? "שולח..." : "להזמין · תשלום בקופה"}
            </button>
          </div>
        </aside>
      </div>

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
