"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { useCart, type CartLine } from "@/components/customer/CartProvider";
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
  IcoEdit,
} from "@/components/shared/Icons";
import { Utensils, ShoppingBag, Banknote } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MenuItemForCustomer } from "@/lib/menu-item-load";
import {
  buildKioskT,
  type KioskOverrides,
} from "@/lib/i18n/kiosk-messages";
import { KioskHeader, KioskHeaderButton } from "./KioskHeader";
import { VirtualKeyboard as KioskKeyboard } from "@/components/shared/VirtualKeyboard";

// Soft-card primary choice button. Used for dine-in vs takeaway and
// for the QR-pay vs pay-at-counter screen - same visual rhythm so
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
  mode: "linked" | "legacy";
  bundle_price: number;
  full_price: number;
  savings: number;
  /** Wolt-mode upgrade target - opens its own ItemDetail when the
   *  customer accepts. Present iff mode === "linked". */
  linked_item?: {
    id: string;
    name: string;
    base_price: number;
    image_url: string | null;
  };
  /** Legacy mode - addons get injected directly into the cart. */
  addons?: Array<{
    item_id: string;
    name: string;
    base_price: number;
    image_url: string | null;
    qty: number;
  }>;
  /** Items in cart that fired this offer - removed from cart when
   *  the suggestion is accepted so the customer doesn't pay for the
   *  trigger items + the combo on top. */
  trigger_item_ids: string[];
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
  kioskCollectPhone,
  kioskRequirePhone,
  stringOverrides,
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
  kioskCollectPhone: boolean;
  kioskRequirePhone: boolean;
  stringOverrides: KioskOverrides;
  categories: KioskCategory[];
  upsellCategoryIds: string[];
  checkoutUpsellCategoryIds: string[];
  items: KioskItem[];
  itemDetails: Record<string, MenuItemForCustomer>;
}) {
  // Per-tenant string lookup. The merchant edits flat dotted-key
  // overrides in Settings → Kiosk → Custom Strings; this `t()` walks
  // override-first, defaults-second, with `{token}` interpolation.
  const t = useMemo(() => buildKioskT(stringOverrides), [stringOverrides]);
  const featuredLabel =
    featuredBadgeLabel?.trim() || t("featured.fallbackLabel");
  const { lines, subtotal, clear, updateQuantity, remove, add, tenant } = useCart();
  const [state, setState] = useState<
    | "start"
    | "mode"
    | "phone-entry"
    | "otp-verify"
    | "browse"
    | "name-entry"
    | "placing"
    | "pay-choice"
    | "pay-qr"
    | "thanks"
  >("start");
  const [diningMode, setDiningMode] = useState<"dinein" | "takeaway" | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  // Optional phone - collected before browse so we can SMS the invoice
  // when Grow ships it. Customer can skip and it stays empty.
  const [customerPhone, setCustomerPhone] = useState<string>("");
  // Returning-customer name preloaded from `/kiosk-lookup` after phone
  // confirm. Empty string means "no prior orders at this tenant" so
  // the name-entry screen renders fresh-input mode.
  const [customerFirstName, setCustomerFirstName] = useState<string>("");
  const [customerLastName, setCustomerLastName] = useState<string>("");
  // Optional email captured on the name-entry screen - when the
  // customer ticks "אני רוצה לקבל חשבונית למייל" we collect their
  // address here so the tax invoice + review-reminder email both go
  // straight to them without a second prompt on the pay page.
  const [wantsInvoice, setWantsInvoice] = useState<boolean>(false);
  const [customerEmail, setCustomerEmail] = useState<string>("");
  // Marketing opt-in checkbox on the name-entry screen. Default off
  // (explicit opt-in only); flows through to Customer.marketingConsent
  // on order create - never writes false, so we never accidentally
  // un-opt-in a customer who said yes on a previous visit.
  const [marketingConsent, setMarketingConsent] = useState<boolean>(false);
  // Did the lookup confirm a prior customer at this tenant? Drives the
  // copy on the name-entry screen ("האם השם נכון?" vs "מה השם שלך?").
  const [nameWasPrefilled, setNameWasPrefilled] = useState(false);
  const [phoneSubmitting, setPhoneSubmitting] = useState(false);
  // Latched true once the customer has completed phone-entry for this
  // session - either by skipping (non-required mode), entering+lookup
  // (non-required), or entering+OTP (required). Lets the mode picker
  // skip phone+OTP on a back-and-forth between dine-in / takeaway and
  // the menu. Reset on full session reset only.
  const [phoneStepDone, setPhoneStepDone] = useState(false);
  // OTP flow state - only used when kioskRequirePhone=true. We track
  // the channel the code was sent through so we can tell the customer
  // "we WhatsApp'd you" vs "we SMS'd you" with the right copy.
  const [otpCode, setOtpCode] = useState<string>("");
  const [otpChannel, setOtpChannel] = useState<"whatsapp" | "sms" | null>(null);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpResendIn, setOtpResendIn] = useState(0);
  // QR-pay session for kiosk card payments. Holds the checkoutId
  // (NOT an Order id - the Order materializes only after Grow confirms
  // payment). orderNumber is null until materialization.
  const [pendingPayOrder, setPendingPayOrder] = useState<{
    checkoutId: string;
    orderNumber: string;
    total: number;
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // "Anything to add before you go?" interstitial - one-shot per
  // checkout attempt. Goes true when the merchant presses "להזמין"
  // and there are upsell candidates; the user either picks something
  // and stays in the cart, or skips and the real placeOrder fires.
  const [checkoutPromptOpen, setCheckoutPromptOpen] = useState(false);
  // Latched once per cart cycle so the same prompt doesn't pop a
  // second time after the user skipped it. Reset on `reset()`.
  const [checkoutPromptShown, setCheckoutPromptShown] = useState(false);
  // Categories and items are loaded separately, so a category with no
  // available items would otherwise render as an empty tab. Only show
  // categories that actually have at least one item.
  const visibleCategories = useMemo(
    () => categories.filter((c) => items.some((it) => it.categoryId === c.id)),
    [categories, items],
  );
  const [activeCat, setActiveCat] = useState<string>(visibleCategories[0]?.id ?? "");
  const [pickItemId, setPickItemId] = useState<string | null>(null);
  // Pencil-icon edit from cart. Stash the line, open ItemDetail in edit mode.
  const [editingLine, setEditingLine] = useState<CartLine | null>(null);
  // Free-text notes keyboard binding inside the item picker.
  const [notesBinding, setNotesBinding] = useState<{
    value: string;
    set: (v: string) => void;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null);
  const [placingError, setPlacingError] = useState<string | null>(null);
  const [bundleSuggestions, setBundleSuggestions] = useState<BundleSuggestion[]>([]);
  const [acceptedBundleIds, setAcceptedBundleIds] = useState<Set<string>>(new Set());
  // The Wolt-style upgrade popup. Re-fires on every fresh trigger
  // add - if a customer dismisses then adds another מלווח, they get
  // prompted again. popupArmedRef is the "an add just happened, look
  // for a bundle to surface on the next suggestion fetch" flag. It
  // gets armed when cart count grows and disarms the moment the popup
  // mounts (so we don't re-arm on the same fetch).
  const [bundlePopup, setBundlePopup] = useState<BundleSuggestion | null>(null);
  const popupArmedRef = useRef(false);
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
  // Which input the on-screen Hebrew keyboard is currently bound to.
  // Each input that opts in sets this on focus/click; the KioskKeyboard
  // at the bottom of the tree reads/writes the matching state slot.
  // `null` keeps the keyboard hidden - search has its own bool above
  // for backwards compatibility with the existing wiring.
  const [kbdTarget, setKbdTarget] = useState<
    "search" | "firstName" | "lastName" | "email" | "notes" | null
  >(null);
  // Drop any name-input keyboard binding when the customer navigates
  // away from name-entry - without this the next visit briefly opens
  // with the wrong target latched in (e.g. coming back from pay-choice
  // would still target "lastName" until they tap an input again).
  useEffect(() => {
    if (
      state !== "name-entry" &&
      (kbdTarget === "firstName" || kbdTarget === "lastName" || kbdTarget === "email")
    ) {
      setKbdTarget(null);
    }
  }, [state, kbdTarget]);
  // Auto-open the keyboard on the first-name field the moment the
  // name-entry screen mounts - saves a tap. Skip if a field is already
  // bound (e.g. bounced back from pay-choice with lastName still latched).
  useEffect(() => {
    if (state === "name-entry" && kbdTarget === null) {
      setKbdTarget("firstName");
    }
  }, [state, kbdTarget]);

  // The customer layout below us renders top nav, FAB, preview bar etc.
  // Cover the lot with a full-viewport overlay so the kiosk reads as a
  // single-purpose appliance, not "the storefront in disguise". Body
  // scroll is locked too - touching the back of the chrome shouldn't
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
  // - no skeleton, no network round-trip. Kiosks have to feel native.
  const pickedItemData = pickItemId ? itemDetails[pickItemId] : null;

  // Idle reset. After idleSeconds of zero touch/click/key the kiosk
  // wipes the cart, closes any open picker, and returns to the start
  // screen - the next customer should never inherit the previous
  // person's half-built order. Five-second polling is fine; we don't
  // need millisecond accuracy.
  const lastActivityRef = useRef(Date.now());
  const reset = useCallback(() => {
    clear();
    setPickItemId(null);
    setQuery("");
    setActiveCat(visibleCategories[0]?.id ?? "");
    setState("start");
    setDiningMode(null);
    setCartOpen(false);
    setCheckoutPromptOpen(false);
    setCheckoutPromptShown(false);
    setAcceptedBundleIds(new Set());
    setBundlePopup(null);
    popupArmedRef.current = false;
    setEditingLine(null);
    setCustomerPhone("");
    setCustomerFirstName("");
    setCustomerLastName("");
    setWantsInvoice(false);
    setCustomerEmail("");
    setMarketingConsent(false);
    setNameWasPrefilled(false);
    setPhoneSubmitting(false);
    setPhoneStepDone(false);
    setOtpCode("");
    setOtpChannel(null);
    setOtpSubmitting(false);
    setOtpError(null);
    setOtpResendIn(0);
    setBundleSuggestions([]);
    setPlacedOrderNumber(null);
    setPlacingError(null);
    setPendingPayOrder(null);
    setQrDataUrl(null);
    setKbdOpen(false);
    setKbdTarget(null);
    setHelpOpen(false);
    setPendingBundleSwap(null);
  }, [clear, visibleCategories]);

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

  // When the customer accepts a Wolt-style linked bundle we don't add
  // anything to the cart ourselves - we open the combo's ItemDetail so
  // they pick variants (drink choice, size, …) and add it on their own
  // terms. Once the combo actually lands in the cart we swap the
  // trigger items out so the cart doesn't carry the trigger pizza AND
  // the combo that includes a pizza. baselineCount captures how many
  // copies of the linked item were already in cart before the prompt,
  // so the watcher only fires on the new addition (idempotent).
  const [pendingBundleSwap, setPendingBundleSwap] = useState<{
    bundleId: string;
    linkedItemId: string;
    triggerItemIds: string[];
    baselineCount: number;
  } | null>(null);

  function acceptBundle(b: BundleSuggestion) {
    if (b.mode === "linked" && b.linked_item) {
      const linkedId = b.linked_item.id;
      const baselineCount = lines.filter((l) => l.itemId === linkedId).length;
      setPendingBundleSwap({
        bundleId: b.id,
        linkedItemId: linkedId,
        triggerItemIds: b.trigger_item_ids,
        baselineCount,
      });
      setCartOpen(false);
      setPickItemId(linkedId);
      return;
    }
    // Legacy addons path - inject the configured items directly.
    for (const a of b.addons ?? []) {
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

  // Watcher for the linked-bundle swap. Once we detect the combo
  // landed in the cart (count exceeds the baseline captured when the
  // customer accepted), purge the trigger items so they're not
  // double-billed.
  useEffect(() => {
    if (!pendingBundleSwap) return;
    const { linkedItemId, triggerItemIds, baselineCount, bundleId } =
      pendingBundleSwap;
    const currentCount = lines.filter((l) => l.itemId === linkedItemId).length;
    if (currentCount <= baselineCount) return;
    for (const l of lines) {
      if (triggerItemIds.includes(l.itemId)) {
        remove(l.lineId);
      }
    }
    setPendingBundleSwap(null);
    setAcceptedBundleIds((prev) => {
      const next = new Set(prev);
      next.add(bundleId);
      return next;
    });
  }, [lines, pendingBundleSwap, remove]);

  // Wolt-style upgrade popup. Re-fires on every fresh trigger add:
  // when a new add arms popupArmedRef (cart count grew) and the
  // resulting bundleSuggestions fetch returns a linked bundle, the
  // popup mounts. Disarm the moment we set it so we don't double-mount
  // off the same fetch. The popup itself is gated on !pickItemId +
  // !pendingBundleSwap so it never stacks over the ItemDetail
  // closing-animation or an in-progress trigger swap.
  useEffect(() => {
    if (!popupArmedRef.current) return;
    if (bundlePopup) return;
    if (pickItemId) return;
    if (pendingBundleSwap) return;
    const linked = bundleSuggestions.find((b) => b.mode === "linked");
    if (!linked) return;
    popupArmedRef.current = false;
    setBundlePopup(linked);
  }, [bundleSuggestions, bundlePopup, pickItemId, pendingBundleSwap]);

  // If the customer opened the combo (acceptBundle → setPickItemId)
  // but backed out without adding it, clear pendingBundleSwap so the
  // popup can fire again on the next trigger. Without this, a single
  // back-out would suppress the popup for the rest of the session.
  useEffect(() => {
    if (pickItemId) return;
    if (!pendingBundleSwap) return;
    const { linkedItemId, baselineCount } = pendingBundleSwap;
    const currentCount = lines.filter((l) => l.itemId === linkedItemId).length;
    if (currentCount <= baselineCount) {
      setPendingBundleSwap(null);
    }
  }, [pickItemId, pendingBundleSwap, lines]);

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
    const grew = itemCount > prevItemCountRef.current;
    if (grew) {
      if (!cartOpen) setCartPulseKey((k) => k + 1);
      // Arm the bundle popup for the next suggestions fetch so a fresh
      // add always re-prompts (even for a bundle the customer dismissed
      // a moment ago). Disarmed when the popup actually mounts.
      popupArmedRef.current = true;
    }
    prevItemCountRef.current = itemCount;
  }, [itemCount, cartOpen]);

  useEffect(() => {
    if (state === "start") return;
    // While we're waiting for a phone-side payment, the customer isn't
    // touching the kiosk on purpose - extend the idle timeout to a long
    // absolute window (8 min) so the kiosk doesn't reset mid-payment.
    const effectiveIdle = state === "pay-qr" ? 480 : idleSeconds;
    const handle = window.setInterval(() => {
      const idle = (Date.now() - lastActivityRef.current) / 1000;
      if (idle >= effectiveIdle) reset();
    }, 5000);
    return () => window.clearInterval(handle);
  }, [state, idleSeconds, reset]);

  // Build the QR image once a pending payment order is set. Target is the
  // customer-facing pay page on the same origin - they scan, the phone
  // opens the Grow wallet there. Empty origin (SSR/initial render) is fine;
  // the kiosk only renders this client-side.
  useEffect(() => {
    if (state !== "pay-qr" || !pendingPayOrder) {
      setQrDataUrl(null);
      return;
    }
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/s/${tenantSlug}/pay-checkout/${pendingPayOrder.checkoutId}`;
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

  // Poll the checkout. When Grow's callback materializes the order, the
  // checkout flips to status=completed with order_id populated - at that
  // point we know the customer paid and the kitchen has the ticket.
  useEffect(() => {
    if (state !== "pay-qr" || !pendingPayOrder) return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch(
          `/api/v1/customer/kiosk-checkout/${pendingPayOrder.checkoutId}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data?.checkout?.status === "completed" && data?.order?.number) {
          stopped = true;
          setPlacedOrderNumber(data.order.number);
          setPendingPayOrder((prev) =>
            prev ? { ...prev, orderNumber: data.order.number } : prev,
          );
          setState("thanks");
        }
      } catch {
        /* keep polling */
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

  // Helper - same logic, parameterized over the merchant's category
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

  // Returning-customer name lookup - same path whether we got here
  // straight from phone-entry (kioskRequirePhone=false) or via OTP
  // verify (kioskRequirePhone=true). Always lands the user on `browse`.
  // Hoisted so both the manual "verify" button AND the auto-submit
  // effect that fires when the 6th digit lands can reuse it. Standard
  // OTP UX is "no submit button needed - typing the last digit just
  // verifies"; the button stays as a fallback for accessibility +
  // retry-after-error.
  const verifyKioskOtp = useCallback(
    async (code: string) => {
      if (otpSubmitting) return;
      if (code.length !== 6) return;
      setOtpSubmitting(true);
      setOtpError(null);
      try {
        const res = await fetch("/api/v1/customer/kiosk-otp/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: customerPhone, code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setOtpError(
            typeof data?.error?.message === "string"
              ? data.error.message
              : t("otp.invalidCode"),
          );
          setOtpCode("");
          return;
        }
        await runLookupAndProceed(customerPhone.replace(/\D/g, ""));
      } catch {
        setOtpError(t("otp.networkError"));
      } finally {
        setOtpSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [customerPhone, otpSubmitting, t],
  );

  // Auto-submit OTP when the 6th digit lands. Mirrors iOS + every bank
  // OTP screen - typing the last char should just verify, no extra
  // tap required.
  useEffect(() => {
    if (state !== "otp-verify") return;
    const digits = otpCode.replace(/\D/g, "");
    if (digits.length !== 6) return;
    if (otpSubmitting) return;
    void verifyKioskOtp(digits);
  }, [otpCode, state, otpSubmitting, verifyKioskOtp]);

  async function runLookupAndProceed(phoneDigits: string) {
    try {
      const res = await fetch("/api/v1/customer/kiosk-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_slug: tenantSlug, phone: phoneDigits }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.found) {
        setCustomerFirstName(String(data.first_name ?? ""));
        setCustomerLastName(String(data.last_name ?? ""));
        setNameWasPrefilled(true);
      } else {
        setCustomerFirstName("");
        setCustomerLastName("");
        setNameWasPrefilled(false);
      }
    } catch {
      /* lookup is non-blocking - proceed anyway */
    }
    // Latch "phone step is done" so a back-and-forth through mode-picker
    // doesn't re-prompt phone+OTP - only a full session reset clears it.
    setPhoneStepDone(true);
    setState("browse");
  }

  // Issue a fresh OTP for this phone. Used both by phone-entry's
  // "המשך" button when kioskRequirePhone=true and by the resend
  // button on the OTP screen. Sets otpChannel + otpResendIn so the UI
  // can render "we WhatsApp'd you" / "resend in 28s".
  async function issueKioskOtp(phoneDigits: string): Promise<boolean> {
    setOtpError(null);
    try {
      const res = await fetch("/api/v1/customer/kiosk-otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_slug: tenantSlug, phone: phoneDigits }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpError(
          typeof data?.error?.message === "string"
            ? data.error.message
            : t("otp.deliveryFailed"),
        );
        return false;
      }
      if (data?.channel === "whatsapp" || data?.channel === "sms") {
        setOtpChannel(data.channel);
      }
      setOtpResendIn(60);
      return true;
    } catch {
      setOtpError(t("errors.network"));
      return false;
    }
  }

  // Countdown timer for the "resend in Xs" hint on the OTP screen.
  // Only ticks while otp-verify is the active state and the timer is
  // positive - re-entering the screen restarts the countdown via
  // issueKioskOtp's setOtpResendIn(60).
  useEffect(() => {
    if (state !== "otp-verify" || otpResendIn <= 0) return;
    const t = window.setInterval(() => {
      setOtpResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [state, otpResendIn]);

  function advanceToPayment() {
    setCheckoutPromptOpen(false);
    setCartOpen(false);
    // When the tenant requires phone+name, route through the name-entry
    // screen first - the customer confirms (or types) the name we'll
    // print on the kitchen ticket. The screen itself decides where to
    // go next (pay-choice or straight to cash placeOrder).
    if (kioskRequirePhone) {
      setState("name-entry");
      return;
    }
    if (growEnabled) {
      setState("pay-choice");
      return;
    }
    void placeOrder("cash");
  }

  async function placeOrder(method: "cash" | "card") {
    setState("placing");
    setPlacingError(null);
    setCheckoutPromptOpen(false);
    const diningNote =
      diningMode === "dinein"
        ? t("diningNote.dineIn")
        : t("diningNote.takeaway");
    const sharedBody = {
      tenant_slug: tenantSlug,
      method: "pickup",
      kiosk: true,
      customer_notes: diningNote,
      applied_bundle_ids: Array.from(acceptedBundleIds),
      ...(customerPhone.replace(/\D/g, "").length === 10
        ? { guest_phone: customerPhone }
        : {}),
      ...(customerFirstName.trim()
        ? { guest_first_name: customerFirstName.trim() }
        : {}),
      ...(customerLastName.trim()
        ? { guest_last_name: customerLastName.trim() }
        : {}),
      ...(wantsInvoice && /^\S+@\S+\.\S+$/.test(customerEmail.trim())
        ? { customer_email: customerEmail.trim() }
        : {}),
      ...(marketingConsent ? { marketing_consent: true } : {}),
      lines: lines.map((l) => ({
        item_id: l.itemId,
        quantity: l.quantity,
        size_id: l.sizeId,
        option_ids: l.options.map((o) => o.optionId),
      })),
    };

    try {
      if (method === "card") {
        // Kiosk card flow: create a KioskPendingCheckout (cart snapshot).
        // The Order itself materializes only when Grow confirms payment.
        const res = await fetch("/api/v1/customer/kiosk-checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...sharedBody, payment_method: "card" }),
        });
        const data = await res.json();
        if (!res.ok || !data?.checkout?.id) {
          setPlacingError(data?.error?.message ?? t("errors.placingFailed"));
          setState("pay-choice");
          return;
        }
        setPendingPayOrder({
          checkoutId: data.checkout.id,
          orderNumber: "",
          total: data.checkout.amount ?? subtotal,
        });
        setState("pay-qr");
        return;
      }

      // Cash: existing flow - Order created immediately at status=pending,
      // cashier confirms via "מזומן התקבל" in the Kanban.
      const res = await fetch("/api/v1/customer/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...sharedBody, payment_method: "cash" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlacingError(data?.error?.message ?? t("errors.placingFailed"));
        setState("browse");
        return;
      }
      setPlacedOrderNumber(data?.order?.number ?? null);
      setState("thanks");
    } catch {
      setPlacingError(t("errors.networkFeminine"));
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
        aria-label={t("header.startBtnAria")}
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
            {/* Soft black wash - knocks the photo back so it reads as
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
              {welcomeText?.trim() ||
                t("start.welcomeFallback", { tenantName })}
            </h1>
            <p className={cn("text-2xl", coverImage ? "text-white/85" : "text-qf-ink2")}>
              {t("start.instruction")}
            </p>
          </div>
          <span
            className="px-16 py-7 rounded-3xl bg-(--qf-primary) text-white text-3xl font-black shadow-2xl"
          >
            {t("start.cta")}
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
          <KioskHeaderButton onClick={reset}>
            {t("header.cancelBtn")}
          </KioskHeaderButton>
        </KioskHeader>
        <div className="flex-1 flex flex-col items-center justify-center gap-14 p-12 text-center">
          <div className="space-y-2">
            <div className="text-sm font-bold tracking-[0.18em] text-qf-mute uppercase">
              {t("start.cta")}
            </div>
            <h2 className="text-5xl font-black text-qf-ink tracking-tight">
              {t("mode.heading")}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">
            <ModeCard
              icon={<Utensils size={64} strokeWidth={1.6} aria-hidden />}
              title={t("mode.dineInTitle")}
              subtitle={t("mode.dineInSubtitle")}
              onClick={() => {
                setDiningMode("dinein");
                // Returning to the picker mid-cart shouldn't re-prompt
                // phone+OTP - only ask once per session. Merchants who
                // turned phone collection off skip the screen entirely.
                setState(
                  !kioskCollectPhone || phoneStepDone ? "browse" : "phone-entry",
                );
              }}
            />
            <ModeCard
              icon={<ShoppingBag size={64} strokeWidth={1.6} aria-hidden />}
              title={t("mode.takeawayTitle")}
              subtitle={t("mode.takeawaySubtitle")}
              onClick={() => {
                setDiningMode("takeaway");
                setState(
                  !kioskCollectPhone || phoneStepDone ? "browse" : "phone-entry",
                );
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Phone entry (optional) ───────────────────────────────────
  if (state === "phone-entry") {
    const digits = customerPhone.replace(/\D/g, "");
    // Customer-service bypass: typing ten 9s lets internal staff sail
    // through OTP without waiting for a WhatsApp/SMS - used when we're
    // walking a customer through the kiosk on the phone. The bypass is
    // silently scrubbed before the order POST so it doesn't pollute
    // the Customer table with a fake "9999999999" number.
    const isOtpBypass = digits === "9999999999";
    const phoneValid = /^05\d{8}$/.test(digits) || isOtpBypass;
    const formatted = digits.length > 3
      ? `${digits.slice(0, 3)}-${digits.slice(3, 10)}`
      : digits;
    const pressDigit = (d: string) => {
      if (digits.length >= 10) return;
      setCustomerPhone(digits + d);
    };
    const pressBackspace = () => setCustomerPhone(digits.slice(0, -1));
    return (
      <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col select-none">
        <KioskHeader logoUrl={logoUrl} tenantName={tenantName}>
          <KioskHeaderButton onClick={reset}>
            {t("header.cancelBtn")}
          </KioskHeaderButton>
        </KioskHeader>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 text-center">
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-black text-qf-ink">
              {kioskRequirePhone
                ? t("phoneEntry.headingRequired")
                : t("phoneEntry.headingOptional")}
            </h2>
            <p className="text-lg text-qf-mute">
              {kioskRequirePhone
                ? t("phoneEntry.subtitleRequired")
                : t("phoneEntry.subtitleOptional")}
            </p>
          </div>

          <div className="w-full max-w-md bg-white border-4 border-qf-line-dash rounded-2xl px-6 py-5 shadow-md">
            <div
              dir="ltr"
              className="text-4xl md:text-5xl font-black tnum text-qf-ink min-h-[1.2em] tracking-wide"
            >
              {formatted || (
                <span className="text-qf-mute/50">{t("phoneEntry.placeholder")}</span>
              )}
            </div>
          </div>

          {/* LTR keypad so "1" sits top-LEFT and "9" bottom-RIGHT - the
              parent column is RTL (Hebrew), and a child grid inherits
              that flow direction, which inverted 1/2/3 visually before. */}
          <div dir="ltr" className="grid grid-cols-3 gap-3 w-full max-w-md">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => pressDigit(d)}
                className="h-20 rounded-2xl bg-white border-2 border-qf-line-dash text-3xl font-black text-qf-ink hover:border-(--qf-primary) active:scale-95 transition shadow-sm"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomerPhone("")}
              disabled={digits.length === 0}
              className="h-20 rounded-2xl bg-white border-2 border-qf-line-dash text-base font-bold text-qf-mute hover:border-qf-tomato hover:text-qf-tomato disabled:opacity-40 active:scale-95 transition shadow-sm"
              aria-label={t("phoneEntry.clearAllLabel")}
            >
              {t("phoneEntry.clearKey")}
            </button>
            <button
              type="button"
              onClick={() => pressDigit("0")}
              className="h-20 rounded-2xl bg-white border-2 border-qf-line-dash text-3xl font-black text-qf-ink hover:border-(--qf-primary) active:scale-95 transition shadow-sm"
            >
              0
            </button>
            <button
              type="button"
              onClick={pressBackspace}
              disabled={digits.length === 0}
              className="h-20 rounded-2xl bg-white border-2 border-qf-line-dash text-2xl font-bold text-qf-mute hover:border-qf-tomato hover:text-qf-tomato disabled:opacity-40 active:scale-95 transition shadow-sm"
              aria-label={t("phoneEntry.backspaceLabel")}
            >
              ⌫
            </button>
          </div>

          <div
            className={cn(
              "grid gap-4 w-full max-w-md",
              kioskRequirePhone ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {!kioskRequirePhone && (
              <button
                type="button"
                onClick={() => {
                  setCustomerPhone("");
                  setPhoneStepDone(true);
                  setState("browse");
                }}
                className="h-16 rounded-2xl border-2 border-qf-line-dash text-qf-ink text-xl font-bold hover:bg-qf-line-soft active:scale-[0.98] transition"
              >
                {t("phoneEntry.skipBtn")}
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                if (!phoneValid || phoneSubmitting) return;
                setCustomerPhone(digits);
                // Bypass: skip OTP entirely, drop the fake phone so the
                // order POST doesn't try to E.164-normalize "9999999999"
                // and bounce with invalid_phone. Order goes through as
                // an anonymous kiosk order.
                if (isOtpBypass) {
                  setCustomerPhone("");
                  setCustomerFirstName("");
                  setCustomerLastName("");
                  setNameWasPrefilled(false);
                  setPhoneStepDone(true);
                  setState("browse");
                  return;
                }
                if (kioskRequirePhone) {
                  // Optimistic flip: jump to the OTP screen the moment
                  // the customer taps המשך - perceived latency drops
                  // from "wait 1-2s on this screen" to "the next screen
                  // is already painting while we send". The OTP screen
                  // reads phoneSubmitting and shows a "שולחים קוד…"
                  // spinner until the API returns and otpChannel flips.
                  setOtpCode("");
                  setOtpError(null);
                  setOtpChannel(null);
                  setPhoneSubmitting(true);
                  setState("otp-verify");
                  void issueKioskOtp(digits).finally(() =>
                    setPhoneSubmitting(false),
                  );
                  return;
                }
                // No phone gate - lookup + go to browse. We DO await
                // here so the user doesn't see the menu before we know
                // their name (the lookup result drives the name-entry
                // pre-fill).
                setPhoneSubmitting(true);
                try {
                  await runLookupAndProceed(digits);
                } finally {
                  setPhoneSubmitting(false);
                }
              }}
              disabled={!phoneValid || phoneSubmitting}
              className="h-16 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xl font-black disabled:opacity-40 shadow-lg active:scale-[0.98] transition"
            >
              {phoneSubmitting ? t("phoneEntry.sendingBtn") : t("phoneEntry.continueBtn")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── OTP verify (after phone-entry when kioskRequirePhone) ────
  if (state === "otp-verify") {
    const codeDigits = otpCode.replace(/\D/g, "");
    const codeReady = codeDigits.length === 6;
    const pressCode = (d: string) => {
      if (codeDigits.length >= 6) return;
      setOtpError(null);
      setOtpCode(codeDigits + d);
    };
    const pressCodeBackspace = () => setOtpCode(codeDigits.slice(0, -1));
    const channelLabel =
      otpChannel === "whatsapp"
        ? t("otp.sentViaWhatsapp")
        : otpChannel === "sms"
          ? t("otp.sentViaSms")
          : t("otp.sentViaFallback");
    const phoneDigits = customerPhone.replace(/\D/g, "");
    const phoneFormatted =
      phoneDigits.length > 3
        ? `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3)}`
        : phoneDigits;
    const codeBoxes = Array.from({ length: 6 }, (_, i) => codeDigits[i] ?? "");
    return (
      <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col select-none">
        <KioskHeader logoUrl={logoUrl} tenantName={tenantName}>
          <KioskHeaderButton
            onClick={() => {
              setOtpCode("");
              setOtpError(null);
              setOtpChannel(null);
              setState("phone-entry");
            }}
          >
            {t("otp.changePhoneBtn")}
          </KioskHeaderButton>
        </KioskHeader>
        <div className="flex-1 flex flex-col items-center justify-center gap-7 p-8 text-center">
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-black text-qf-ink">
              {t("otp.heading")}
            </h2>
            <p className="text-lg text-qf-mute inline-flex items-center justify-center gap-2 flex-wrap">
              {phoneSubmitting && !otpChannel ? (
                <>
                  <span className="qf-spinner text-(--qf-primary)" aria-hidden />
                  <span>{t("otp.sendingTo")}</span>
                </>
              ) : (
                <span>{channelLabel} {t("otp.toLabel")}</span>
              )}
              <span dir="ltr" className="tnum font-bold">{phoneFormatted}</span>
            </p>
          </div>

          {/* 6 boxes that render the typed code LTR. Visually the kiosk
              user sees the same shape as iOS/Android SMS-autofill OTP. */}
          <div dir="ltr" className="grid grid-cols-6 gap-2 w-full max-w-lg">
            {codeBoxes.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "h-20 rounded-2xl border-2 grid place-items-center text-4xl font-black tnum bg-white transition",
                  i === codeDigits.length && !codeReady
                    ? "border-(--qf-primary) shadow-lg shadow-(--qf-primary)/15"
                    : "border-qf-line-dash",
                )}
              >
                {d || (i === codeDigits.length ? (
                  <span className="w-1 h-10 bg-(--qf-primary) animate-qf-pulse" aria-hidden />
                ) : (
                  <span className="text-qf-line-dash">·</span>
                ))}
              </div>
            ))}
          </div>

          {otpError && (
            <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-base rounded-xl px-5 py-3 max-w-md">
              {otpError}
            </div>
          )}

          <div dir="ltr" className="grid grid-cols-3 gap-3 w-full max-w-md">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => pressCode(d)}
                disabled={otpSubmitting}
                className="h-20 rounded-2xl bg-white border-2 border-qf-line-dash text-3xl font-black text-qf-ink hover:border-(--qf-primary) active:scale-95 transition shadow-sm disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOtpCode("")}
              disabled={codeDigits.length === 0 || otpSubmitting}
              className="h-20 rounded-2xl bg-white border-2 border-qf-line-dash text-base font-bold text-qf-mute hover:border-qf-tomato hover:text-qf-tomato disabled:opacity-40 active:scale-95 transition shadow-sm"
              aria-label={t("phoneEntry.clearAllLabel")}
            >
              {t("phoneEntry.clearKey")}
            </button>
            <button
              type="button"
              onClick={() => pressCode("0")}
              disabled={otpSubmitting}
              className="h-20 rounded-2xl bg-white border-2 border-qf-line-dash text-3xl font-black text-qf-ink hover:border-(--qf-primary) active:scale-95 transition shadow-sm disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={pressCodeBackspace}
              disabled={codeDigits.length === 0 || otpSubmitting}
              className="h-20 rounded-2xl bg-white border-2 border-qf-line-dash text-2xl font-bold text-qf-mute hover:border-qf-tomato hover:text-qf-tomato disabled:opacity-40 active:scale-95 transition shadow-sm"
              aria-label={t("phoneEntry.backspaceLabel")}
            >
              ⌫
            </button>
          </div>

          <div className="flex flex-col items-center gap-3 w-full max-w-md">
            <button
              type="button"
              onClick={() => void verifyKioskOtp(codeDigits)}
              disabled={!codeReady || otpSubmitting}
              className="w-full h-16 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xl font-black disabled:opacity-40 shadow-lg active:scale-[0.98] transition"
            >
              {otpSubmitting ? t("otp.verifyingBtn") : t("otp.verifyBtn")}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (otpResendIn > 0 || otpSubmitting) return;
                setOtpCode("");
                await issueKioskOtp(customerPhone.replace(/\D/g, ""));
              }}
              disabled={otpResendIn > 0 || otpSubmitting}
              className="text-sm text-qf-mute hover:text-(--qf-deep) disabled:opacity-60 underline"
            >
              {otpResendIn > 0
                ? t("otp.resendCountdown", { seconds: otpResendIn })
                : t("otp.resendNow")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Name entry (last step before payment) ───────────────────
  if (state === "name-entry") {
    const trimmedFirst = customerFirstName.trim();
    const trimmedLast = customerLastName.trim();
    const fullDisplay = `${trimmedFirst} ${trimmedLast}`.trim();
    const canContinue = trimmedFirst.length >= 1;
    return (
      <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col select-none">
        <KioskHeader logoUrl={logoUrl} tenantName={tenantName}>
          <KioskHeaderButton
            onClick={() => {
              setState("browse");
              setCartOpen(true);
            }}
          >
            {t("nameEntry.backToCartBtn")}
          </KioskHeaderButton>
        </KioskHeader>
        <div className="flex-1 flex flex-col items-center justify-center gap-7 p-8 text-center">
          <div className="space-y-3 max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-black text-qf-ink">
              {nameWasPrefilled
                ? t("nameEntry.headingPrefilled")
                : t("nameEntry.headingFresh")}
            </h2>
            <p className="text-lg text-qf-mute">
              {nameWasPrefilled
                ? fullDisplay
                  ? t("nameEntry.subtitlePrefilled", { name: fullDisplay })
                  : t("nameEntry.subtitlePrefilledNoName")
                : t("nameEntry.subtitleFresh")}
            </p>
          </div>

          <div className="w-full max-w-md space-y-3">
            <div>
              <label className="block text-sm font-bold text-qf-ink mb-1.5 text-right">
                {t("nameEntry.firstNameLabel")}
              </label>
              <input
                value={customerFirstName}
                onChange={(e) => {
                  setCustomerFirstName(e.target.value);
                  if (nameWasPrefilled) setNameWasPrefilled(false);
                }}
                onFocus={() => setKbdTarget("firstName")}
                onClick={() => setKbdTarget("firstName")}
                onKeyDown={(e) => e.preventDefault()}
                inputMode="none"
                readOnly
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={t("nameEntry.firstNamePlaceholder")}
                maxLength={40}
                className={cn(
                  "w-full px-4 py-4 rounded-2xl border-2 text-2xl bg-white focus:border-(--qf-primary) outline-none text-right transition",
                  kbdTarget === "firstName"
                    ? "border-(--qf-primary) shadow-[0_0_0_4px_rgba(14,122,60,0.08)]"
                    : "border-qf-line-dash",
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-qf-ink mb-1.5 text-right">
                {t("nameEntry.lastNameLabel")}
              </label>
              <input
                value={customerLastName}
                onChange={(e) => {
                  setCustomerLastName(e.target.value);
                  if (nameWasPrefilled) setNameWasPrefilled(false);
                }}
                onFocus={() => setKbdTarget("lastName")}
                onClick={() => setKbdTarget("lastName")}
                onKeyDown={(e) => e.preventDefault()}
                inputMode="none"
                readOnly
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={t("nameEntry.lastNamePlaceholder")}
                maxLength={40}
                className={cn(
                  "w-full px-4 py-4 rounded-2xl border-2 text-2xl bg-white focus:border-(--qf-primary) outline-none text-right transition",
                  kbdTarget === "lastName"
                    ? "border-(--qf-primary) shadow-[0_0_0_4px_rgba(14,122,60,0.08)]"
                    : "border-qf-line-dash",
                )}
              />
            </div>

            {/* One unified card for the invoice opt-in. Header row is
                always visible; ticking it expands the card to reveal
                the email field + the nested marketing consent. Closing
                the card resets the email and the marketing tick, so a
                customer who toggles off doesn't accidentally leave
                stale opt-ins behind. */}
            <div
              className={cn(
                "rounded-2xl border-2 bg-white transition overflow-hidden",
                wantsInvoice
                  ? "border-(--qf-primary) shadow-[0_0_0_4px_rgba(14,122,60,0.08)]"
                  : "border-qf-line-dash",
              )}
            >
              <label className="flex items-center gap-3 px-4 py-3.5 cursor-pointer text-right">
                <input
                  type="checkbox"
                  checked={wantsInvoice}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setWantsInvoice(v);
                    if (!v) {
                      setCustomerEmail("");
                      setMarketingConsent(false);
                      if (kbdTarget === "email") setKbdTarget(null);
                    }
                  }}
                  className="w-6 h-6 accent-(--qf-primary) shrink-0 cursor-pointer"
                />
                <span className="text-base text-qf-ink flex-1">
                  אני רוצה לקבל חשבונית מס למייל
                </span>
              </label>

              {wantsInvoice && (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-qf-line-soft mt-1">
                  <input
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    onFocus={() => setKbdTarget("email")}
                    onClick={() => setKbdTarget("email")}
                    onKeyDown={(e) => e.preventDefault()}
                    inputMode="none"
                    readOnly
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="name@example.com"
                    maxLength={120}
                    dir="ltr"
                    className={cn(
                      "w-full mt-3 px-4 py-3.5 rounded-xl border-2 text-xl bg-white focus:border-(--qf-primary) outline-none text-left transition tnum",
                      kbdTarget === "email"
                        ? "border-(--qf-primary) shadow-[0_0_0_3px_rgba(14,122,60,0.08)]"
                        : "border-qf-line-dash",
                    )}
                  />

                  <label className="flex items-start gap-3 cursor-pointer text-right pt-1">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="w-5 h-5 accent-(--qf-primary) shrink-0 cursor-pointer mt-0.5"
                    />
                    <span className="text-sm text-qf-ink2 flex-1 leading-snug">
                      אני מאשר/ת לשלוח לי תוכן שיווקי/פרסומי אודות ההזמנות שלי
                  
                    </span>
                  </label>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!canContinue) return;
              // Require a syntactically valid email if the customer
              // opted into the invoice - otherwise the upstream order
              // create silently drops the bad address and they think
              // they'll get an invoice that never comes.
              if (wantsInvoice && !/^\S+@\S+\.\S+$/.test(customerEmail.trim())) {
                setKbdTarget("email");
                return;
              }
              if (growEnabled) {
                setState("pay-choice");
              } else {
                void placeOrder("cash");
              }
            }}
            disabled={!canContinue}
            className="w-full max-w-md h-16 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xl font-black disabled:opacity-40 shadow-lg active:scale-[0.98] transition"
          >
            {t("nameEntry.continueBtn")}
          </button>
        </div>

        {/* On-screen Hebrew keyboard - rebound to whichever name input
            the customer tapped. Browse-screen's own keyboard mount lives
            past an early return that this branch never reaches, so we
            mount a dedicated instance here. */}
        {kbdTarget === "firstName" && (
          <KioskKeyboard
            value={customerFirstName}
            onChange={(v) => {
              setCustomerFirstName(v);
              if (nameWasPrefilled) setNameWasPrefilled(false);
            }}
            onClose={() => setKbdTarget(null)}
          />
        )}
        {kbdTarget === "lastName" && (
          <KioskKeyboard
            value={customerLastName}
            onChange={(v) => {
              setCustomerLastName(v);
              if (nameWasPrefilled) setNameWasPrefilled(false);
            }}
            onClose={() => setKbdTarget(null)}
          />
        )}
        {kbdTarget === "email" && (
          <KioskKeyboard
            value={customerEmail}
            onChange={setCustomerEmail}
            onClose={() => setKbdTarget(null)}
          />
        )}
      </div>
    );
  }

  // ─── Submitting order (between pay-choice and pay-qr/thanks) ──
  // Without this branch the "placing" state falls through to the
  // browse render, so for a heartbeat between the customer tapping
  // "תשלום בטלפון" and the QR / thanks screen mounting, the menu
  // flashes on screen - which reads as "my order vanished".
  if (state === "placing") {
    return (
      <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col items-center justify-center gap-6 p-12 text-center select-none">
        <span
          className="qf-spinner text-(--qf-primary)"
          style={{ width: "4rem", height: "4rem", borderWidth: "5px" }}
          aria-hidden
        />
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-qf-ink tracking-tight">
            {t("placing.heading")}
          </h2>
          <p className="text-base text-qf-mute">{t("placing.subtitle")}</p>
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
            {t("payChoice.backToCartBtn")}
          </KioskHeaderButton>
        </KioskHeader>
        <div className="flex-1 flex flex-col items-center justify-center gap-12 p-12 text-center">
          <div className="space-y-3">
            <div className="text-sm font-bold tracking-[0.18em] text-qf-mute uppercase">
              {t("payChoice.bumperLabel")}
            </div>
            <h2 className="text-5xl font-black text-qf-ink tracking-tight">
              {t("payChoice.heading")}
            </h2>
            <p className="text-xl text-qf-ink2 tnum">
              {t("payChoice.totalPrefix")} <span className="font-bold text-qf-ink">{formatPrice(subtotal)}</span>
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-3xl">
            <ModeCard
              icon={<IcoQrCode c="currentColor" s={64} />}
              title={t("payChoice.phonePayTitle")}
              subtitle={t("payChoice.phonePaySubtitle")}
              onClick={() => void placeOrder("card")}
              disabled={lines.length === 0}
            />
            <ModeCard
              icon={<Banknote size={64} strokeWidth={1.6} aria-hidden />}
              title={t("payChoice.counterPayTitle")}
              subtitle={t("payChoice.counterPaySubtitle")}
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
          <KioskHeaderButton variant="danger" onClick={reset}>
            {t("payQr.cancelBtn")}
          </KioskHeaderButton>
        </KioskHeader>
        <div className="flex-1 grid lg:grid-cols-2 overflow-hidden">
          <section className="flex flex-col items-center justify-center gap-7 p-10 bg-white border-b lg:border-b-0 lg:border-e border-qf-line-soft">
            <div className="text-center space-y-2 max-w-sm">
              <div className="text-xs font-bold tracking-[0.18em] text-qf-mute uppercase">
                {t("payQr.miniHeading")}
              </div>
              <h2 className="text-3xl font-black text-qf-ink tracking-tight">
                {t("payQr.heading")}
              </h2>
              <p className="text-base text-qf-ink2">
                {t("payQr.instructions")}
              </p>
            </div>
            <div className="bg-white p-5 rounded-[28px] border border-qf-line-soft shadow-[0_8px_40px_rgba(17,35,26,0.08)]">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={t("payQr.qrAlt")}
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
              {t("payQr.waiting")}
            </div>
          </section>
          <section className="flex flex-col gap-7 p-10 lg:p-14 justify-center">
            <div className="space-y-1.5">
              <div className="text-sm text-qf-mute">{t("payQr.totalLabel")}</div>
              <div className="text-6xl lg:text-7xl font-black tnum text-qf-ink tracking-tight">
                {formatPrice(pendingPayOrder?.total ?? subtotal)}
              </div>
              {pendingPayOrder?.orderNumber && (
                <div className="text-base text-qf-mute tnum">
                  {t("payQr.orderNumberLine", { number: pendingPayOrder.orderNumber })}
                </div>
              )}
            </div>
            <ol className="space-y-3.5 text-lg text-qf-ink">
              {[
                t("payQr.step1"),
                t("payQr.step2"),
                t("payQr.step3"),
                t("payQr.step4"),
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
              {t("payQr.failNote")}
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
            {paidViaQr
              ? t("thanks.paidViaQrHeading")
              : t("thanks.paidAtCounterHeading")}
          </h1>
          {placedOrderNumber && (
            <p className="text-3xl font-bold tnum text-qf-ink2">#{placedOrderNumber}</p>
          )}
          <p className="text-xl text-qf-mute">
            {paidViaQr
              ? t("thanks.paidViaQrSubtitle")
              : t("thanks.paidAtCounterSubtitle")}
          </p>
        </div>
      </div>
    );
  }

  // ─── Browse + cart ─────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] bg-qf-bg flex flex-col select-none">
      <KioskHeader
        logoUrl={logoUrl}
        tenantName={tenantName}
        startAction={
          pickItemId ? (
            <KioskHeaderButton
              onClick={() => {
                setPickItemId(null);
                setEditingLine(null);
              }}
              startIcon={<IcoChev s={18} />}
            >
              {editingLine ? "חזרה לעגלה" : t("picker.backToMenu")}
            </KioskHeaderButton>
          ) : null
        }
      >
        {diningMode && (
          <KioskHeaderButton
            variant="soft"
            ariaLabel={t("header.modeChangeAria")}
            onClick={() => setState("mode")}
            startIcon={
              diningMode === "dinein" ? (
                <Utensils size={18} strokeWidth={2.2} aria-hidden />
              ) : (
                <ShoppingBag size={18} strokeWidth={2.2} aria-hidden />
              )
            }
          >
            {diningMode === "dinein"
              ? t("header.dineInChip")
              : t("header.takeawayChip")}
          </KioskHeaderButton>
        )}
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          aria-label={t("header.helpAria")}
          className="w-12 h-12 rounded-xl text-qf-ink2 hover:bg-qf-line-soft grid place-items-center transition"
        >
          <IcoHelp c="currentColor" s={22} />
        </button>
        <KioskHeaderButton onClick={reset}>
          {t("header.restartBtn")}
        </KioskHeaderButton>
      </KioskHeader>

      <div className="flex-1 flex min-h-0 pb-28">
        {/* Side category nav. Vertical list, large touch targets,
            collapsed scroll. Hidden when a search query is active -
            the search results span every category anyway. */}
        {!query && visibleCategories.length > 0 && (
          <nav className="w-56 lg:w-64 shrink-0 border-e border-qf-line-soft bg-white overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {visibleCategories.map((c) => {
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
            // On xl+ (proper kiosk hardware, 1280px+) the picker lives
            // inline so the header + category sidebar stay visible. On
            // smaller screens (tablet, small monitors) the inline layout
            // would squeeze ItemDetail too narrow - so the picker
            // escapes the main column and covers the area BELOW the
            // sticky header (top-[76px], where the kiosk header sits).
            // Critically it does NOT cover the header, so the "לשבת /
            // עזרה / התחל מחדש" buttons stay reachable.
            <div className="kiosk-scope max-xl:fixed max-xl:top-[81px] max-xl:inset-x-0 max-xl:bottom-0 max-xl:z-[35] max-xl:bg-qf-bg max-xl:flex max-xl:flex-col">
              <div className="max-xl:flex-1 max-xl:overflow-y-auto">
                {pickedItemData ? (
                  <ItemDetail
                    tenantSlug={tenantSlug}
                    businessType={businessType as never}
                    item={pickedItemData as never}
                    inModal
                    kioskMode
                    editLine={editingLine ?? undefined}
                    onNotesKeyboard={(value, set) => {
                      setNotesBinding({ value, set });
                      setKbdTarget("notes");
                    }}
                    onClose={() => {
                      setPickItemId(null);
                      setEditingLine(null);
                      setNotesBinding(null);
                      if (kbdTarget === "notes") setKbdTarget(null);
                      if (editingLine) setCartOpen(true);
                    }}
                    addSource="menu"
                  />
                ) : (
                  <div className="p-10 text-center text-qf-mute">
                    {t("picker.itemNotFound")}
                  </div>
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
                  onKeyDown={(e) => e.preventDefault()}
                  inputMode="none"
                  readOnly
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t("browse.searchPlaceholder")}
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
                    aria-label={t("browse.clearSearchAria")}
                  >
                    <IcoClose s={18} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filtered.length === 0 && (
                  <div className="col-span-full text-center text-qf-mute text-lg py-12">
                    {query
                      ? t("browse.noMatch", { query })
                      : t("browse.emptyCategory")}
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

      {/* Cart sticky bar - collapsed by default so the menu owns the
          screen. The pulse animation re-keys every add so the bar
          visibly nudges and reminds the customer it's there. Hidden
          while the item picker is open - ItemDetail has its own
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
            "pointer-events-auto w-full flex items-center justify-between gap-4 px-8 h-[112px] rounded-3xl text-white transition disabled:cursor-default shadow-[0_-4px_20px_rgba(0,0,0,0.15)]",
            itemCount > 0
              ? "bg-(--qf-primary) hover:bg-(--qf-deep) active:scale-[0.99] animate-qf-cart-attention"
              : "bg-qf-ink2/80",
          )}
          aria-label={itemCount > 0 ? t("cart.openAria") : t("cart.emptyAria")}
        >
          {itemCount === 0 ? (
            <span className="w-full text-center text-2xl font-semibold tracking-tight">
              {t("cart.emptyCta")}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-3.5">
                <span className="inline-grid place-items-center w-14 h-14 rounded-full bg-white/15 text-2xl font-black tnum">
                  {itemCount}
                </span>
                <span className="text-2xl font-bold tracking-tight">
                  {t("cart.viewCart")}
                </span>
              </span>
              <span className="inline-flex items-center gap-3.5">
                <span className="text-4xl font-black tnum">{formatPrice(subtotal)}</span>
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
            className="w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl flex flex-col min-h-[30vh] max-h-[85vh] animate-qf-sheet-in"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-6 py-4 border-b border-qf-line-soft flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-qf-mute tracking-wider">{t("cart.sectionLabel")}</div>
                <div className="text-2xl font-black mt-1">
                  {itemCount}{" "}
                  {itemCount === 1 ? t("cart.itemSingular") : t("cart.itemPlural")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="w-12 h-12 rounded-xl hover:bg-qf-line-soft grid place-items-center"
                aria-label={t("cart.closeAria")}
              >
                <IcoClose s={20} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {lines.length === 0 ? (
                <div className="text-center text-qf-mute text-base py-10">{t("cart.emptyState")}</div>
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
                            {l.notes && (
                              <div className="text-xs text-qf-ink2 leading-snug mt-1 italic">
                                {l.notes}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLine(l);
                                setPickItemId(l.itemId);
                                setCartOpen(false);
                              }}
                              className="w-10 h-10 rounded-full bg-white border border-qf-line-soft text-qf-ink2 hover:text-qf-ink hover:border-qf-line grid place-items-center shadow-[0_1px_2px_rgba(17,35,26,0.06)] transition"
                              aria-label="ערוך"
                            >
                              <IcoEdit s={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(l.lineId)}
                              className="w-10 h-10 rounded-full bg-white border border-qf-line-soft text-qf-mute hover:text-qf-tomato hover:border-qf-tomato/40 grid place-items-center shadow-[0_1px_2px_rgba(17,35,26,0.06)] transition"
                              aria-label={t("cart.removeAria")}
                            >
                              <IcoClose s={18} />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="inline-flex items-center bg-white rounded-full border border-qf-line-soft shadow-[0_1px_2px_rgba(17,35,26,0.06)]">
                            <button
                              type="button"
                              onClick={() => updateQuantity(l.lineId, Math.max(1, l.quantity - 1))}
                              disabled={l.quantity <= 1}
                              className="w-12 h-12 grid place-items-center disabled:opacity-40"
                              aria-label={t("cart.decrementAria")}
                            >
                              <IcoMinus s={20} />
                            </button>
                            <div className="w-8 text-center text-lg font-bold tnum">{l.quantity}</div>
                            <button
                              type="button"
                              onClick={() => updateQuantity(l.lineId, Math.min(20, l.quantity + 1))}
                              disabled={l.quantity >= 20}
                              className="w-12 h-12 grid place-items-center disabled:opacity-40"
                              aria-label={t("cart.incrementAria")}
                            >
                              <IcoPlus c="#11231a" s={20} />
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
                <div className="text-sm font-black text-(--qf-deep) mb-2">{t("bundle.sectionTitle")}</div>
                <div className="space-y-2">
                  {bundleSuggestions.map((b) => {
                    const accepted = acceptedBundleIds.has(b.id);
                    return (
                      <div
                        key={b.id}
                        className="bg-white rounded-2xl border border-(--qf-primary)/25 p-3.5 flex items-center gap-3 shadow-[0_2px_8px_rgba(14,122,60,0.06)]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black truncate">
                            {b.mode === "linked" && b.linked_item
                              ? b.linked_item.name
                              : b.name}
                          </div>
                          <div className="text-xs text-qf-mute mt-0.5">
                            {b.mode === "linked"
                              ? b.name
                              : (b.addons ?? [])
                                  .map((a) => (a.qty > 1 ? `${a.qty}× ${a.name}` : a.name))
                                  .join(" + ")}
                          </div>
                          <div className="text-xs mt-1 tnum">
                            <span className="font-bold text-(--qf-deep)">{formatPrice(b.bundle_price)}</span>
                            {b.savings > 0 && (
                              <>
                                <span className="text-qf-mute line-through ms-2">{formatPrice(b.full_price)}</span>
                                <span className="text-qf-tomato font-bold ms-2">
                                  {t("bundle.savingsLabel", { amount: formatPrice(b.savings) })}
                                </span>
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
                              {t("bundle.addedBtn")}
                            </>
                          ) : b.mode === "linked" ? (
                            "שדרג"
                          ) : (
                            t("bundle.addBtn")
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
                <div className="text-sm font-bold text-qf-mute mb-2">{t("upsell.cartSectionTitle")}</div>
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
                        aria-label={
                          it.needsConfig
                            ? t("upsell.addNeedsConfigAria", { name: it.name })
                            : t("upsell.addAria", { name: it.name })
                        }
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
                <span className="text-base text-qf-mute">{t("cart.totalLabel")}</span>
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
                  disabled={lines.length === 0}
                  className="h-20 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-2xl font-black disabled:opacity-50 shadow-[0_6px_24px_rgba(14,122,60,0.28)] active:scale-[0.98] transition"
                >
                  {t("cart.checkoutBtn")}
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  className="h-20 px-6 rounded-2xl border-2 border-qf-line-soft text-qf-ink2 text-lg font-bold hover:bg-qf-line-soft transition"
                >
                  {t("cart.continueBrowsingBtn")}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* "Anything to add before you go?" interstitial - last-chance
          upsell after the customer hits "place order". Stays a sheet
          like the cart for visual continuity. */}
      {checkoutPromptOpen && checkoutUpsellSuggestions.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh] animate-qf-sheet-in">
            <header className="px-6 py-5 border-b border-qf-line-soft text-center">
              <h2 className="text-2xl font-black text-qf-ink">
                {t("checkoutUpsell.heading")}
              </h2>
              <p className="text-sm text-qf-mute mt-1">{t("checkoutUpsell.subtitle")}</p>
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
                {t("checkoutUpsell.skipBtn")}
              </button>
              <button
                type="button"
                onClick={() => setCheckoutPromptOpen(false)}
                className="h-14 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-base font-bold shadow-[0_4px_16px_rgba(14,122,60,0.25)] active:scale-[0.98] transition"
              >
                {t("checkoutUpsell.backBtn")}
              </button>
            </footer>
          </div>
        </div>
      )}

      {kbdOpen && !pickItemId && (
        <KioskKeyboard
          value={query}
          onChange={setQuery}
          onClose={() => setKbdOpen(false)}
        />
      )}

      {kbdTarget === "notes" && notesBinding && (
        <KioskKeyboard
          value={notesBinding.value}
          onChange={(v) => {
            notesBinding.set(v);
            setNotesBinding({ value: v, set: notesBinding.set });
          }}
          onClose={() => {
            setKbdTarget(null);
            setNotesBinding(null);
          }}
          placeholder="הקלידו הערה - לדוגמה: בלי בצל, חתוך ל-8"
          maxLength={200}
        />
      )}

      {/* Same keyboard, re-bound to whichever name input the customer
          tapped on the name-entry screen. The target state decides
          which slot it writes to so a single instance handles both
          first/last name without flicker between fields. */}
      {kbdTarget === "firstName" && (
        <KioskKeyboard
          value={customerFirstName}
          onChange={(v) => {
            setCustomerFirstName(v);
            if (nameWasPrefilled) setNameWasPrefilled(false);
          }}
          onClose={() => setKbdTarget(null)}
        />
      )}
      {kbdTarget === "lastName" && (
        <KioskKeyboard
          value={customerLastName}
          onChange={(v) => {
            setCustomerLastName(v);
            if (nameWasPrefilled) setNameWasPrefilled(false);
          }}
          onClose={() => setKbdTarget(null)}
        />
      )}

      {/* Bundle upgrade popup - fires the moment a fresh add lands a
          linked bundle in the suggestion list. Gated on !pickItemId
          so it doesn't stack on top of the ItemDetail modal that's
          mid-closing-animation when the customer adds the trigger
          item. */}
      {bundlePopup && !pickItemId && bundlePopup.linked_item && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55 backdrop-blur-sm p-6">
          <div className="w-full max-w-2xl bg-white rounded-[28px] shadow-2xl overflow-hidden animate-qf-modal-in">
            {bundlePopup.linked_item.image_url ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bundlePopup.linked_item.image_url}
                  alt={bundlePopup.linked_item.name}
                  className="w-full h-80 object-cover"
                />
                {bundlePopup.savings > 0 && (
                  <div className="absolute top-4 start-4 bg-qf-tomato text-white text-base font-black px-4 py-1.5 rounded-full shadow-[0_4px_16px_rgba(194,66,31,0.4)] tnum">
                    חוסכים {formatPrice(bundlePopup.savings)}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-32 bg-(--qf-soft)" />
            )}
            <div className="p-8 space-y-6 text-center">
              <div className="space-y-2.5">
                <div className="text-base font-bold text-(--qf-primary)">
                  {bundlePopup.savings > 0
                    ? `תרצה לשדרג ולחסוך ${formatPrice(bundlePopup.savings)}?`
                    : "תרצה לשדרג?"}
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-qf-ink tracking-tight leading-tight break-words px-2">
                  {bundlePopup.linked_item.name}
                </h2>
              </div>
              <div className="flex items-baseline justify-center gap-3 tnum">
                <span className="text-5xl font-black text-(--qf-primary)">
                  {formatPrice(bundlePopup.bundle_price)}
                </span>
                {bundlePopup.savings > 0 && (
                  <span className="text-xl text-qf-mute line-through">
                    {formatPrice(bundlePopup.full_price)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-[1fr_1.5fr] gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setBundlePopup(null)}
                  className="h-16 rounded-2xl border-2 border-qf-line-soft hover:bg-qf-line-soft text-qf-ink2 text-lg font-bold transition"
                >
                  אני מוותר
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const b = bundlePopup;
                    setBundlePopup(null);
                    if (b) acceptBundle(b);
                  }}
                  className="h-16 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xl font-black shadow-[0_8px_28px_rgba(14,122,60,0.35)] active:scale-[0.98] transition"
                >
                  שדרג
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help modal - short flow recap + tiny "powered by QuickFood"
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
                  {t("help.bumper")}
                </div>
                <h2 className="text-2xl font-black text-qf-ink tracking-tight mt-1">
                  {t("help.heading")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="w-11 h-11 rounded-xl hover:bg-qf-line-soft grid place-items-center text-qf-mute shrink-0"
                aria-label={t("help.closeAria")}
              >
                <IcoClose s={20} />
              </button>
            </header>
            <ol className="px-7 pb-5 space-y-3.5 text-base text-qf-ink">
              {[
                t("help.step1"),
                t("help.step2"),
                t("help.step3"),
                t("help.step4"),
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
                {t("help.poweredByLine")}
              </p>
              <a
                href="tel:0542284283"
                className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-qf-ink text-white text-sm font-bold hover:bg-qf-ink2 transition"
              >
                <IcoPhone c="currentColor" s={16} />
                {t("help.callBtn")}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
