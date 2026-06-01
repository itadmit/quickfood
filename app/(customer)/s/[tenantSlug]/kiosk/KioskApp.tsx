"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { useCart } from "@/components/customer/CartProvider";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";
import {
  IcoPlus,
  IcoMinus,
  IcoSearch,
  IcoClose,
  IcoChev,
  IcoCheck,
  IcoQrCode,
  IcoHelp,
  IcoPhone,
} from "@/components/shared/Icons";
import { Utensils, ShoppingBag, Banknote } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MenuItemForCustomer } from "@/lib/menu-item-load";
import { KioskHeader, KioskHeaderButton } from "./KioskHeader";
import { KioskKeyboard } from "./KioskKeyboard";

// Soft-card primary choice button. Used for dine-in vs takeaway and
// for the QR-pay vs pay-at-counter screen — same visual rhythm so
// each step of the kiosk flow feels like the same family of choices.
function ModeCard({
  icon,
  title,
  subtitle,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group bg-white rounded-3xl border border-qf-line-soft p-10 flex flex-col items-center gap-6 active:scale-[0.99] transition shadow-[0_2px_18px_rgba(17,35,26,0.06)] hover:shadow-[0_8px_32px_rgba(17,35,26,0.1)] hover:border-(--qf-primary)/40 disabled:opacity-60 disabled:pointer-events-none"
    >
      <div className="w-20 h-20 rounded-2xl bg-(--qf-soft) text-(--qf-deep) grid place-items-center group-hover:bg-(--qf-primary)/15 transition">
        {icon}
      </div>
      <div className="space-y-1.5">
        <div className="text-2xl font-bold text-qf-ink tracking-tight">{title}</div>
        <div className="text-base text-qf-mute">{subtitle}</div>
      </div>
    </button>
  );
}

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

interface BundleSuggestion {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  bundle_price: number;
  full_price: number;
  savings: number;
  addons: Array<{
    item_id: string;
    name: string;
    base_price: number;
    image_url: string | null;
    qty: number;
  }>;
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
  growEnabled,
  categories,
  upsellCategoryIds,
  checkoutUpsellCategoryIds,
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
  growEnabled: boolean;
  categories: KioskCategory[];
  upsellCategoryIds: string[];
  checkoutUpsellCategoryIds: string[];
  items: KioskItem[];
  itemDetails: Record<string, MenuItemForCustomer>;
}) {
  const featuredLabel = featuredBadgeLabel?.trim() || "מומלץ של השף";
  const { lines, subtotal, clear, updateQuantity, remove, add, tenant } = useCart();
  const [state, setState] = useState<
    "start" | "mode" | "browse" | "placing" | "pay-choice" | "pay-qr" | "thanks"
  >("start");
  const [diningMode, setDiningMode] = useState<"dinein" | "takeaway" | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  // Pending payment session — set when an order was created with
  // payment_method=card and the QR is being shown. Polled until paid.
  const [pendingPayOrder, setPendingPayOrder] = useState<{
    orderId: string;
    orderNumber: string;
    total: number;
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // "Anything to add before you go?" interstitial — one-shot per
  // checkout attempt. Goes true when the merchant presses "להזמין"
  // and there are upsell candidates; the user either picks something
  // and stays in the cart, or skips and the real placeOrder fires.
  const [checkoutPromptOpen, setCheckoutPromptOpen] = useState(false);
  // Latched once per cart cycle so the same prompt doesn't pop a
  // second time after the user skipped it. Reset on `reset()`.
  const [checkoutPromptShown, setCheckoutPromptShown] = useState(false);
  const [activeCat, setActiveCat] = useState<string>(categories[0]?.id ?? "");
  const [pickItemId, setPickItemId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null);
  const [placingError, setPlacingError] = useState<string | null>(null);
  const [bundleSuggestions, setBundleSuggestions] = useState<BundleSuggestion[]>([]);
  const [acceptedBundleIds, setAcceptedBundleIds] = useState<Set<string>>(new Set());
  // Cart-attention pulse: bumps the bottom bar each time the cart
  // count grows so customers register that the cart lives down there
  // and is tappable. Keyed by an incrementing token (not booleans) so
  // re-triggers actually restart the CSS animation.
  const [cartPulseKey, setCartPulseKey] = useState(0);
  const prevItemCountRef = useRef(0);
  const [helpOpen, setHelpOpen] = useState(false);
  // On-screen Hebrew keyboard. Opens when the search field gets a
  // pointer-tap; the input itself carries inputMode=none so the
  // device's native keyboard never tries to mount.
  const [kbdOpen, setKbdOpen] = useState(false);

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
    setCheckoutPromptOpen(false);
    setCheckoutPromptShown(false);
    setAcceptedBundleIds(new Set());
    setBundleSuggestions([]);
    setPlacedOrderNumber(null);
    setPlacingError(null);
    setPendingPayOrder(null);
    setQrDataUrl(null);
    setKbdOpen(false);
    setHelpOpen(false);
  }, [clear, categories]);

  // Fetch matching bundle offers whenever the cart changes. The
  // server filters to bundles whose triggers are present + addons
  // not already in cart, so we only render what would actually fire.
  useEffect(() => {
    if (lines.length === 0) {
      setBundleSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const itemIds = Array.from(new Set(lines.map((l) => l.itemId))).join(",");
    fetch(
      `/api/v1/customer/cart-bundles?tenant=${encodeURIComponent(tenantSlug)}&items=${itemIds}`,
      { signal: ctrl.signal },
    )
      .then((r) => (r.ok ? r.json() : { bundles: [] }))
      .then((d: { bundles?: BundleSuggestion[] }) => setBundleSuggestions(d.bundles ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [lines, tenantSlug]);

  function acceptBundle(b: BundleSuggestion) {
    for (const a of b.addons) {
      const detail = itemDetails[a.item_id];
      for (let i = 0; i < a.qty; i++) {
        add({
          itemId: a.item_id,
          name: a.name,
          basePrice: a.base_price,
          artType: detail?.artType ?? null,
          imageUrl: a.image_url,
          quantity: 1,
          sizeId: null,
          sizeName: null,
          sizeDelta: 0,
          options: [],
          notes: null,
          source: "upsell",
        });
      }
    }
    setAcceptedBundleIds((prev) => {
      const next = new Set(prev);
      next.add(b.id);
      return next;
    });
  }

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

  // Cart attention: whenever the total item count goes up (a new
  // item landed in the cart while the bar was collapsed), trigger
  // the bump animation on the bottom CTA so the customer notices
  // the cart bar exists and is tappable.
  const itemCount = lines.reduce((acc, l) => acc + l.quantity, 0);
  useEffect(() => {
    if (itemCount > prevItemCountRef.current && !cartOpen) {
      setCartPulseKey((k) => k + 1);
    }
    prevItemCountRef.current = itemCount;
  }, [itemCount, cartOpen]);

  useEffect(() => {
    if (state === "start") return;
    // While we're waiting for a phone-side payment, the customer isn't
    // touching the kiosk on purpose — extend the idle timeout to a long
    // absolute window (8 min) so the kiosk doesn't reset mid-payment.
    const effectiveIdle = state === "pay-qr" ? 480 : idleSeconds;
    const handle = window.setInterval(() => {
      const idle = (Date.now() - lastActivityRef.current) / 1000;
      if (idle >= effectiveIdle) reset();
    }, 5000);
    return () => window.clearInterval(handle);
  }, [state, idleSeconds, reset]);

  // Build the QR image once a pending payment order is set. Target is the
  // customer-facing pay page on the same origin — they scan, the phone
  // opens the Grow wallet there. Empty origin (SSR/initial render) is fine;
  // the kiosk only renders this client-side.
  useEffect(() => {
    if (state !== "pay-qr" || !pendingPayOrder) {
      setQrDataUrl(null);
      return;
    }
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/s/${tenantSlug}/pay/${pendingPayOrder.orderId}`;
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: 640,
      margin: 1,
      color: { dark: "#11231a", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [state, pendingPayOrder, tenantSlug]);

  // Poll the order's payment_status while the QR is shown. When the Grow
  // callback flips paymentStatus → paid (and the order to confirmed), the
  // kiosk jumps to its existing "תודה" screen.
  useEffect(() => {
    if (state !== "pay-qr" || !pendingPayOrder) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch(
          `/api/v1/customer/orders/${pendingPayOrder.orderId}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data?.order?.payment_status === "paid") {
          stopped = true;
          setState("thanks");
        }
      } catch {
        /* network blip — keep polling */
      }
    };
    void tick();
    const handle = window.setInterval(tick, 3000);
    return () => {
      stopped = true;
      window.clearInterval(handle);
    };
  }, [state, pendingPayOrder]);

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

  // Helper — same logic, parameterized over the merchant's category
  // flag (upsellInCart for the in-cart strip, upsellBeforeCheckout
  // for the dessert prompt). Filters out anything already in the cart
  // and caps to 4 so the screen stays tidy.
  const buildUpsell = useCallback(
    (categoryIds: string[]): Array<KioskItem & { needsConfig: boolean }> => {
      if (categoryIds.length === 0) return [];
      const inCart = new Set(lines.map((l) => l.itemId));
      const upsellSet = new Set(categoryIds);
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
    },
    [items, itemDetails, lines],
  );
  const upsellSuggestions = useMemo(
    () => buildUpsell(upsellCategoryIds),
    [buildUpsell, upsellCategoryIds],
  );
  const checkoutUpsellSuggestions = useMemo(
    () => buildUpsell(checkoutUpsellCategoryIds),
    [buildUpsell, checkoutUpsellCategoryIds],
  );

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

  function startCheckout() {
    // One-shot "anything else?" interstitial. Fires only when the
    // merchant flagged at least one category as upsellBeforeCheckout
    // and there are still un-cart'd items in those categories. After
    // the customer skips or adds once, we don't bother them again on
    // the next "להזמין" click (until they reset).
    if (
      !checkoutPromptShown &&
      checkoutUpsellSuggestions.length > 0 &&
      lines.length > 0 &&
      state !== "placing"
    ) {
      setCheckoutPromptShown(true);
      setCheckoutPromptOpen(true);
      return;
    }
    advanceToPayment();
  }

  function advanceToPayment() {
    setCheckoutPromptOpen(false);
    if (growEnabled) {
      // Customer picks QR-pay or pay-at-counter on the next screen.
      setCartOpen(false);
      setState("pay-choice");
      return;
    }
    // No online payment configured — fall back to the legacy "pay at
    // counter" flow (creates a cash order).
    void placeOrder("cash");
  }

  async function placeOrder(method: "cash" | "card") {
    setState("placing");
    setPlacingError(null);
    setCheckoutPromptOpen(false);
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
          payment_method: method,
          kiosk: true,
          customer_notes: diningNote,
          applied_bundle_ids: Array.from(acceptedBundleIds),
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
        setState(method === "card" ? "pay-choice" : "browse");
        return;
      }
      const orderId: string | undefined = data?.order?.id;
      const orderNumber: string | undefined = data?.order?.number;
      const orderTotal: number = data?.order?.total ?? subtotal;

      if (method === "card" && orderId) {
        // Non-cash order is now in DB as `pending` — the kitchen
        // won't see it until the Grow callback flips it to `confirmed`.
        setPendingPayOrder({
          orderId,
          orderNumber: orderNumber ?? "",
          total: orderTotal,
        });
        setPlacedOrderNumber(orderNumber ?? null);
        setState("pay-qr");
        return;
      }

      setPlacedOrderNumber(orderNumber ?? null);
      setState("thanks");
    } catch {
      setPlacingError("שגיאת רשת. נסי שוב.");
      setState(method === "card" ? "pay-choice" : "browse");
    }
  }

  // ─── Start screen ──────────────────────────────────────────────
  if (state === "start") {
    return (
      <button
        type="button"
        onClick={() => setState("mode")}
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-10 p-12 text-center select-none cursor-pointer overflow-hidden isolate"
        style={coverImage ? undefined : { background: "var(--qf-bg)" }}
        aria-label="התחל הזמנה חדשה"
      >
        {coverImage && (
          <>
            {/* Cover image as its own absolutely-positioned layer so we
                can run a slow Ken Burns pan/zoom on it without dragging
                the chrome around. Mounted as a background-image div
                rather than <img> so we keep cover sizing + position. */}
            <div
              aria-hidden
              className="absolute inset-0 animate-qf-kenburns"
              style={{
                backgroundImage: `url(${coverImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            {/* Soft black wash — knocks the photo back so it reads as
                backdrop, not foreground content, and pushes the white
                headline + CTA forward. Detail survives at 30%. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-black/40"
            />
            {/* Bottom-up readability gradient so the headline + CTA stay
                legible regardless of the photo's content area. Kept
                gentle on top, heavier toward the bottom-center where
                the copy sits. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/25 to-transparent"
            />
          </>
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
        <KioskHeader logoUrl={logoUrl} tenantName={tenantName}>
          <KioskHeaderButton onClick={reset}>ביטול</KioskHeaderButton>
        </KioskHeader>
        <div className="flex-1 flex flex-col items-center justify-center gap-14 p-12 text-center">
          <div className="space-y-2">
            <div className="text-sm font-bold tracking-[0.18em] text-qf-mute uppercase">
              הזמנה חדשה
            </div>
            <h2 className="text-5xl font-black text-qf-ink tracking-tight">
              איך נהנים מהארוחה?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">
            <ModeCard
              icon={<Utensils size={64} strokeWidth={1.6} aria-hidden />}
              title="לשבת במסעדה"
              subtitle="אוכל בצלחת + סכו״ם"
              onClick={() => {
                setDiningMode("dinein");
                setState("browse");
              }}
            />
            <ModeCard
              icon={<ShoppingBag size={64} strokeWidth={1.6} aria-hidden />}
              title="לקחת"
              subtitle="ארוז לדרך"
              onClick={() => {
                setDiningMode("takeaway");
                setState("browse");
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Payment-method choice ────────────────────────────────────
  if (state === "pay-choice") {
    return (
      <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col select-none">
        <KioskHeader logoUrl={logoUrl} tenantName={tenantName}>
          <KioskHeaderButton
            onClick={() => {
              setState("browse");
              setCartOpen(true);
            }}
          >
            חזרה לעגלה
          </KioskHeaderButton>
        </KioskHeader>
        <div className="flex-1 flex flex-col items-center justify-center gap-12 p-12 text-center">
          <div className="space-y-3">
            <div className="text-sm font-bold tracking-[0.18em] text-qf-mute uppercase">
              סיום הזמנה
            </div>
            <h2 className="text-5xl font-black text-qf-ink tracking-tight">איך נשלם?</h2>
            <p className="text-xl text-qf-ink2 tnum">
              סה״כ <span className="font-bold text-qf-ink">{formatPrice(subtotal)}</span>
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">
            <ModeCard
              icon={<IcoQrCode c="currentColor" s={64} />}
              title="תשלום בטלפון"
              subtitle="סריקת QR · אשראי / Bit / Apple Pay"
              onClick={() => void placeOrder("card")}
              disabled={lines.length === 0}
            />
            <ModeCard
              icon={<Banknote size={64} strokeWidth={1.6} aria-hidden />}
              title="תשלום בקופה"
              subtitle="מזומן / אשראי בקופה"
              onClick={() => void placeOrder("cash")}
              disabled={lines.length === 0}
            />
          </div>
          {placingError && (
            <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-base rounded-2xl px-5 py-3 max-w-xl">
              {placingError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── QR-pay screen ────────────────────────────────────────────
  if (state === "pay-qr") {
    return (
      <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col select-none">
        <KioskHeader logoUrl={logoUrl} tenantName={tenantName}>
          <KioskHeaderButton onClick={reset}>ביטול</KioskHeaderButton>
        </KioskHeader>
        <div className="flex-1 grid lg:grid-cols-2 overflow-hidden">
          <section className="flex flex-col items-center justify-center gap-7 p-10 bg-white border-b lg:border-b-0 lg:border-e border-qf-line-soft">
            <div className="text-center space-y-2 max-w-sm">
              <div className="text-xs font-bold tracking-[0.18em] text-qf-mute uppercase">
                סרקו לתשלום
              </div>
              <h2 className="text-3xl font-black text-qf-ink tracking-tight">
                סרקו עם הטלפון
              </h2>
              <p className="text-base text-qf-ink2">
                פתחו את מצלמת הטלפון, כוונו אל הקוד והשלימו את התשלום.
              </p>
            </div>
            <div className="bg-white p-5 rounded-[28px] border border-qf-line-soft shadow-[0_8px_40px_rgba(17,35,26,0.08)]">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="QR לתשלום"
                  className="w-72 h-72 lg:w-80 lg:h-80"
                />
              ) : (
                <div className="w-72 h-72 lg:w-80 lg:h-80 grid place-items-center text-qf-mute">
                  <span className="qf-spinner text-(--qf-primary)" aria-hidden />
                </div>
              )}
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-(--qf-soft) text-(--qf-deep) text-sm font-semibold">
              <span className="qf-spinner text-current" aria-hidden />
              ממתינים לתשלום…
            </div>
          </section>
          <section className="flex flex-col gap-7 p-10 lg:p-14 justify-center">
            <div className="space-y-1.5">
              <div className="text-sm text-qf-mute">סה״כ לתשלום</div>
              <div className="text-6xl lg:text-7xl font-black tnum text-qf-ink tracking-tight">
                {formatPrice(pendingPayOrder?.total ?? subtotal)}
              </div>
              {pendingPayOrder?.orderNumber && (
                <div className="text-base text-qf-mute tnum">
                  הזמנה #{pendingPayOrder.orderNumber}
                </div>
              )}
            </div>
            <ol className="space-y-3.5 text-lg text-qf-ink">
              {[
                "סרקו את הקוד עם מצלמת הטלפון",
                "בחרו אמצעי תשלום: אשראי / Bit / Apple Pay",
                "השלימו את התשלום בטלפון",
                "ההזמנה תועבר אוטומטית למטבח",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3.5">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-(--qf-soft) text-(--qf-deep) grid place-items-center font-black text-base tnum">
                    {i + 1}
                  </span>
                  <span className="leading-snug pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <div className="p-4 rounded-2xl bg-qf-line-soft/60 text-qf-ink2 text-sm">
              לא מצליחים? אפשר לבטל ולשלם בקופה.
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ─── Thanks screen ─────────────────────────────────────────────
  if (state === "thanks") {
    const paidViaQr = !!pendingPayOrder;
    return (
      <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col items-center justify-center gap-10 p-12 text-center select-none">
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 rounded-full bg-(--qf-soft) animate-qf-pulse"
          />
          <div className="relative w-36 h-36 rounded-full bg-(--qf-primary) text-white grid place-items-center shadow-[0_12px_36px_rgba(14,122,60,0.35)] animate-qf-check-in">
            <IcoCheck c="currentColor" s={64} />
          </div>
        </div>
        <div className="space-y-3 max-w-2xl">
          <h1 className="text-5xl font-black text-qf-ink tracking-tight">
            {paidViaQr ? "התשלום התקבל" : "ההזמנה התקבלה"}
          </h1>
          {placedOrderNumber && (
            <p className="text-3xl font-bold tnum text-qf-ink2">#{placedOrderNumber}</p>
          )}
          <p className="text-xl text-qf-mute">
            {paidViaQr ? "ההזמנה הועברה למטבח. בתאבון!" : "תוכלו לשלם בקופה. בתאבון!"}
          </p>
        </div>
      </div>
    );
  }

  // ─── Browse + cart ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col select-none">
      <KioskHeader logoUrl={logoUrl} tenantName={tenantName}>
        {diningMode && (
          <KioskHeaderButton
            variant="soft"
            ariaLabel="שינוי בחירת ישיבה/לקיחה"
            onClick={() => setState("mode")}
            startIcon={
              diningMode === "dinein" ? (
                <Utensils size={18} strokeWidth={2.2} aria-hidden />
              ) : (
                <ShoppingBag size={18} strokeWidth={2.2} aria-hidden />
              )
            }
          >
            {diningMode === "dinein" ? "לשבת" : "לקחת"}
          </KioskHeaderButton>
        )}
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label="עזרה"
          className="w-12 h-12 rounded-xl text-qf-ink2 hover:bg-qf-line-soft grid place-items-center transition"
        >
          <IcoHelp c="currentColor" s={22} />
        </button>
        <KioskHeaderButton onClick={reset}>התחל מחדש</KioskHeaderButton>
      </KioskHeader>

      <div className="flex-1 flex min-h-0 pb-28">
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
                      onClick={() => {
                        setActiveCat(c.id);
                        setPickItemId(null);
                      }}
                      className={cn(
                        "w-full text-right px-4 py-3.5 rounded-xl text-lg font-bold transition",
                        active
                          ? "bg-(--qf-primary) text-white shadow-[0_4px_14px_rgba(14,122,60,0.25)]"
                          : "bg-transparent text-qf-ink2 hover:bg-qf-line-soft hover:text-qf-ink",
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

        <main className="flex-1 overflow-y-auto">
          {pickItemId ? (
            // On lg+ (kiosk hardware), the picker lives inline so the
            // header + category sidebar stay visible. On smaller
            // screens (tablet portrait, phones) it escapes to a
            // fullscreen layer — the inline layout would squeeze the
            // ItemDetail too narrow to be usable.
            <div className="kiosk-scope max-lg:fixed max-lg:inset-0 max-lg:z-[55] max-lg:bg-qf-bg max-lg:flex max-lg:flex-col">
              <div className="sticky top-0 z-10 bg-qf-bg/95 backdrop-blur px-6 py-3 border-b border-qf-line-soft max-lg:static max-lg:bg-white max-lg:shrink-0">
                <button
                  type="button"
                  onClick={() => setPickItemId(null)}
                  className="inline-flex items-center gap-2 h-11 px-4 rounded-xl text-qf-ink2 text-base font-semibold hover:bg-qf-line-soft transition"
                >
                  <IcoChev s={20} />
                  חזרה לתפריט
                </button>
              </div>
              <div className="max-lg:flex-1 max-lg:overflow-y-auto">
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
          ) : (
            <div className="max-w-5xl mx-auto space-y-6 p-6">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setKbdOpen(true)}
                  onClick={() => setKbdOpen(true)}
                  inputMode="none"
                  placeholder="חיפוש בתפריט"
                  className="w-full ps-14 pe-4 py-4 rounded-2xl border border-qf-line-soft text-xl bg-white focus:border-(--qf-primary) focus:shadow-[0_0_0_4px_rgba(14,122,60,0.08)] outline-none transition caret-(--qf-primary)"
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
                    onClick={() => {
                      setPickItemId(it.id);
                      setKbdOpen(false);
                    }}
                    className="bg-white border border-qf-line-soft rounded-2xl overflow-hidden text-right hover:border-(--qf-primary)/50 hover:shadow-[0_6px_24px_rgba(17,35,26,0.08)] transition active:scale-[0.98] relative shadow-[0_1px_2px_rgba(17,35,26,0.04)]"
                  >
                    {it.featured && (
                      <span
                        className="absolute top-3 start-3 z-10 bg-(--qf-primary) text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-[0_2px_8px_rgba(14,122,60,0.3)]"
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
                    <div className="p-4 space-y-1">
                      <div className="text-base font-bold leading-snug line-clamp-2 min-h-[2.6em] text-qf-ink">{it.name}</div>
                      <div className="text-base font-semibold text-qf-ink2 tnum">{formatPrice(it.basePrice)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Cart sticky bar — collapsed by default so the menu owns the
          screen. The pulse animation re-keys every add so the bar
          visibly nudges and reminds the customer it's there. Hidden
          while the item picker is open — ItemDetail has its own
          add-to-cart footer there, so two cart CTAs would compete.
          Also hidden while the on-screen keyboard is up so it
          doesn't sit on top of the keys. */}
      <div
        className={cn(
          "fixed bottom-0 inset-x-0 z-30 px-4 pb-5 pointer-events-none",
          (pickItemId || kbdOpen) && "hidden",
        )}
      >
        <button
          key={cartPulseKey}
          type="button"
          onClick={() => itemCount > 0 && setCartOpen(true)}
          disabled={itemCount === 0}
          className={cn(
            "pointer-events-auto w-full flex items-center justify-between gap-4 px-7 h-[88px] rounded-2xl text-white transition disabled:cursor-default shadow-[0_-4px_20px_rgba(0,0,0,0.15)]",
            itemCount > 0
              ? "bg-(--qf-primary) hover:bg-(--qf-deep) active:scale-[0.99] animate-qf-cart-attention"
              : "bg-qf-ink2/80",
          )}
          aria-label={itemCount > 0 ? "פתח עגלה" : "העגלה ריקה"}
        >
          {itemCount === 0 ? (
            <span className="w-full text-center text-xl font-semibold tracking-tight">
              הוסיפו פריט כדי להזמין
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-3.5">
                <span className="inline-grid place-items-center w-11 h-11 rounded-full bg-white/15 text-lg font-black tnum">
                  {itemCount}
                </span>
                <span className="text-xl font-bold tracking-tight">
                  לצפייה בעגלה
                </span>
              </span>
              <span className="inline-flex items-center gap-3.5">
                <span className="text-3xl font-black tnum">{formatPrice(subtotal)}</span>
                <IcoChev c="#fff" s={22} className="rotate-90" />
              </span>
            </>
          )}
        </button>
      </div>

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
                    <div key={l.lineId} className="bg-qf-line-soft/40 rounded-2xl p-3 flex items-start gap-3">
                      <div className="w-20 h-20 rounded-xl bg-white border border-qf-line-soft overflow-hidden shrink-0 relative">
                        <MenuItemImage
                          src={l.imageUrl ?? undefined}
                          alt={l.name}
                          businessType={businessType}
                          size={120}
                          rounded="none"
                          fill
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-bold leading-tight text-qf-ink">{l.name}</div>
                            {l.sizeName && (
                              <div className="text-sm text-qf-mute mt-0.5">{l.sizeName}</div>
                            )}
                            {l.options.length > 0 && (
                              <div className="text-sm text-qf-mute leading-snug mt-0.5">
                                {l.options.map((o) => o.name).join(" · ")}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => remove(l.lineId)}
                            className="w-8 h-8 rounded-full text-qf-mute hover:text-qf-tomato hover:bg-qf-tomato-soft grid place-items-center transition shrink-0"
                            aria-label="הסר"
                          >
                            <IcoClose s={16} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="inline-flex items-center bg-white rounded-full border border-qf-line-soft shadow-[0_1px_2px_rgba(17,35,26,0.04)]">
                            <button
                              type="button"
                              onClick={() => updateQuantity(l.lineId, Math.max(1, l.quantity - 1))}
                              disabled={l.quantity <= 1}
                              className="w-10 h-10 grid place-items-center disabled:opacity-40"
                              aria-label="הפחת"
                            >
                              <IcoMinus s={16} />
                            </button>
                            <div className="w-8 text-center text-base font-bold tnum">{l.quantity}</div>
                            <button
                              type="button"
                              onClick={() => updateQuantity(l.lineId, Math.min(20, l.quantity + 1))}
                              disabled={l.quantity >= 20}
                              className="w-10 h-10 grid place-items-center disabled:opacity-40"
                              aria-label="הוסף"
                            >
                              <IcoPlus c="#11231a" s={16} />
                            </button>
                          </div>
                          <div className="text-lg font-black tnum text-qf-ink">{formatPrice(lineTotal)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {bundleSuggestions.length > 0 && (
              <div className="border-t border-qf-line-soft px-5 py-4 bg-(--qf-soft)">
                <div className="text-sm font-black text-(--qf-deep) mb-2">מבצעים פתוחים בסל</div>
                <div className="space-y-2">
                  {bundleSuggestions.map((b) => {
                    const accepted = acceptedBundleIds.has(b.id);
                    return (
                      <div
                        key={b.id}
                        className="bg-white rounded-2xl border border-(--qf-primary)/25 p-3.5 flex items-center gap-3 shadow-[0_2px_8px_rgba(14,122,60,0.06)]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black truncate">{b.name}</div>
                          <div className="text-xs text-qf-mute mt-0.5">
                            {b.addons
                              .map((a) => (a.qty > 1 ? `${a.qty}× ${a.name}` : a.name))
                              .join(" + ")}
                          </div>
                          <div className="text-xs mt-1 tnum">
                            <span className="font-bold text-(--qf-deep)">{formatPrice(b.bundle_price)}</span>
                            {b.savings > 0 && (
                              <>
                                <span className="text-qf-mute line-through ms-2">{formatPrice(b.full_price)}</span>
                                <span className="text-qf-tomato font-bold ms-2">חוסכים {formatPrice(b.savings)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => acceptBundle(b)}
                          disabled={accepted}
                          className={cn(
                            "shrink-0 inline-flex items-center gap-1.5 px-4 h-10 rounded-xl text-sm font-bold transition",
                            accepted
                              ? "bg-(--qf-soft) text-(--qf-deep)"
                              : "bg-(--qf-primary) text-white hover:bg-(--qf-deep) active:scale-95",
                          )}
                        >
                          {accepted ? (
                            <>
                              <IcoCheck c="currentColor" s={14} />
                              נוסף
                            </>
                          ) : (
                            "תוסיפו"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {upsellSuggestions.length > 0 && lines.length > 0 && (
              <div className="border-t border-qf-line-soft px-5 py-4 bg-qf-line-soft/30">
                <div className="text-sm font-bold text-qf-mute mb-2">להוסיף משהו?</div>
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar">
                  {upsellSuggestions.map((it) => (
                    <div
                      key={it.id}
                      className="shrink-0 w-32 bg-white border border-qf-line-soft rounded-2xl overflow-hidden text-right relative shadow-[0_1px_2px_rgba(17,35,26,0.04)]"
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
            <footer className="px-6 py-5 border-t border-qf-line-soft space-y-3.5 bg-white">
              <div className="flex items-baseline justify-between">
                <span className="text-base text-qf-mute">סה״כ</span>
                <span className="text-4xl font-black tnum text-qf-ink tracking-tight">{formatPrice(subtotal)}</span>
              </div>
              {placingError && (
                <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3.5 py-2.5">
                  {placingError}
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={lines.length === 0 || state === "placing"}
                  className="h-16 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xl font-black disabled:opacity-50 shadow-[0_6px_24px_rgba(14,122,60,0.28)] active:scale-[0.98] transition"
                >
                  {state === "placing" ? "שולח..." : "מעבר לתשלום"}
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="h-16 px-5 rounded-2xl text-qf-ink2 text-base font-bold hover:bg-qf-line-soft transition"
                >
                  המשך לקנות
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* "Anything to add before you go?" interstitial — last-chance
          upsell after the customer hits "place order". Stays a sheet
          like the cart for visual continuity. */}
      {checkoutPromptOpen && checkoutUpsellSuggestions.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] animate-qf-sheet-in">
            <header className="px-6 py-5 border-b border-qf-line-soft text-center">
              <h2 className="text-2xl font-black text-qf-ink">
                להוסיף משהו לפני שמסיימים?
              </h2>
              <p className="text-sm text-qf-mute mt-1">המנות הכי טעימות שלנו לסגירת הארוחה</p>
            </header>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {checkoutUpsellSuggestions.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => quickAddUpsell(it)}
                    className="bg-white border border-qf-line-soft rounded-2xl overflow-hidden text-right hover:border-(--qf-primary)/40 hover:shadow-[0_6px_20px_rgba(17,35,26,0.07)] transition active:scale-[0.98] shadow-[0_1px_2px_rgba(17,35,26,0.04)]"
                  >
                    <div className="aspect-square bg-qf-line-soft relative">
                      <MenuItemImage
                        src={it.imageUrl ?? undefined}
                        alt={it.name}
                        businessType={businessType}
                        size={200}
                        rounded="none"
                        fill
                      />
                    </div>
                    <div className="p-3">
                      <div className="text-base font-bold leading-tight line-clamp-2 min-h-[2.4em]">
                        {it.name}
                      </div>
                      <div className="text-sm text-qf-mute tnum mt-1">{formatPrice(it.basePrice)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <footer className="px-6 py-4 border-t border-qf-line-soft grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={advanceToPayment}
                className="h-14 rounded-2xl border border-qf-line-soft hover:bg-qf-line-soft text-qf-ink2 text-base font-bold transition"
              >
                לא תודה, להזמין
              </button>
              <button
                type="button"
                onClick={() => setCheckoutPromptOpen(false)}
                className="h-14 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-base font-bold shadow-[0_4px_16px_rgba(14,122,60,0.25)] active:scale-[0.98] transition"
              >
                חזרה לעגלה
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* On-screen Hebrew keyboard for the search field. Mounts only
          when the search input has focus, so the rest of the menu
          stays clean. */}
      {kbdOpen && !pickItemId && (
        <KioskKeyboard
          value={query}
          onChange={setQuery}
          onClose={() => setKbdOpen(false)}
        />
      )}

      {/* Help modal — short flow recap + tiny "powered by QuickFood"
          attribution with a sales phone CTA, so passers-by who like
          what they see know who to call. */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 backdrop-blur-sm p-6"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl animate-qf-modal-in overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-7 pt-7 pb-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold tracking-[0.18em] text-qf-mute uppercase">
                  עזרה
                </div>
                <h2 className="text-2xl font-black text-qf-ink tracking-tight mt-1">
                  איך מזמינים בקיוסק?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="w-11 h-11 rounded-xl hover:bg-qf-line-soft grid place-items-center text-qf-mute shrink-0"
                aria-label="סגור"
              >
                <IcoClose s={20} />
              </button>
            </header>
            <ol className="px-7 pb-5 space-y-3.5 text-base text-qf-ink">
              {[
                "בחרו פריט מהתפריט.",
                "בחרו תוספות וגודל אם רוצים.",
                "פתחו את העגלה למטה ולחצו על מעבר לתשלום.",
                "שלמו בטלפון בסריקת QR או בקופה.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-7 h-7 shrink-0 rounded-full bg-(--qf-soft) text-(--qf-deep) grid place-items-center font-black text-sm tnum">
                    {i + 1}
                  </span>
                  <span className="leading-snug pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <div className="border-t border-qf-line-soft bg-qf-line-soft/30 px-7 py-5 space-y-3">
              <p className="text-sm text-qf-ink2 leading-relaxed">
                מערכת קיוסק חכמה ל-מסעדות מ-<span className="font-bold text-qf-ink">QuickFood</span>.
                רוצים אחת כזו אצלכם?
              </p>
              <a
                href="tel:0542284283"
                className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-qf-ink text-white text-sm font-bold hover:bg-qf-ink2 transition"
              >
                <IcoPhone c="currentColor" s={16} />
                חייגו עכשיו · 054-228-4283
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
