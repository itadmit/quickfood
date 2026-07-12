"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { computeDeliveryFee } from "@/lib/delivery-fee";
import { matchZoneByCity, type ZoneForMatch } from "@/lib/delivery-zone-match";
import { readDeliveryChoice, DELIVERY_CHOICE_EVENT } from "@/lib/delivery-city-storage";
import type { BranchHours } from "@/lib/branch-hours";

export type CartLineSource = "menu" | "ai_advisor" | "upsell" | "reorder";

export interface CartLine {
  /** stable id of this line in the cart (uuid) */
  lineId: string;
  itemId: string;
  name: string;
  basePrice: number;
  artType: string | null;
  imageUrl: string | null;
  quantity: number;
  sizeId: string | null;
  sizeName: string | null;
  sizeDelta: number;
  options: Array<{ groupId: string; optionId: string; name: string; groupName?: string; priceDelta: number; half?: "left" | "right" | "full" }>;
  notes: string | null;
  /** How this line landed in the cart - powers the merchant analytics
   *  breakdown of channel performance. Defaults to "menu" so old carts
   *  in localStorage stay valid. */
  source?: CartLineSource;
  /** Present when this line is a composed fixed-price deal. itemId then
   *  holds the deal id, basePrice the fixed price, and options[] carries
   *  DISPLAY entries (chosen dishes + paid extras) so the cart renders the
   *  composition natively. Checkout routes these lines into the `deals`
   *  payload instead of `lines`. Deal lines are not editable in place. */
  deal?: {
    dealId: string;
    units: Array<{ slotId: string; itemId: string; optionIds: string[] }>;
  };
}

/** A bundle offer the customer accepted on the cart screen. We keep the
 *  savings alongside the id so the cart/checkout summaries can show the
 *  discount before the server recomputes it authoritatively at order time. */
export interface AcceptedBundle {
  id: string;
  savings: number;
}

export interface CartState {
  lines: CartLine[];
  method: "delivery" | "pickup";
  acceptedBundles: AcceptedBundle[];
}

interface CartContextValue extends CartState {
  add: (line: Omit<CartLine, "lineId">) => void;
  addMany: (lines: Array<Omit<CartLine, "lineId">>) => void;
  updateLine: (lineId: string, line: Omit<CartLine, "lineId">) => void;
  updateQuantity: (lineId: string, qty: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  setMethod: (m: "delivery" | "pickup") => void;
  /** Bundle offers the customer accepted. Threaded to the order create
   *  call as `applied_bundle_ids`; the server re-verifies + discounts. */
  acceptedBundles: AcceptedBundle[];
  acceptBundle: (id: string, savings: number) => void;
  unacceptBundle: (id: string) => void;
  /** Sum of accepted-bundle savings, capped at subtotal. Subtracted from
   *  the displayed total so the cart matches what the server will charge. */
  bundleDiscount: number;
  subtotal: number;
  itemCount: number;
  /** Delivery fee for the current method/cart, with free-delivery
   *  thresholds already applied. Mirrors the server calculation. */
  deliveryFee: number;
  /** Delivery-time range for the customer's resolved zone, or null when no
   *  zone matches (caller falls back to the store-wide default). */
  deliveryEta: { min: number; max: number } | null;
  tenant: TenantInfo;
  branch: BranchInfo | null;
  /** True once localStorage has been read on mount. Until then,
   * `lines` may transiently look empty even when a cart exists - consumers
   * should suppress empty-state UI while this is false. */
  hydrated: boolean;
}

interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  logoLetter: string;
  themeId: string;
  businessType?: string;
  scheduledOrdersEnabled?: boolean;
  cutleryEnabled?: boolean;
  cutleryLabel?: string;
  cutleryPrice?: number;
  cutleryFreeAbove?: number | null;
  // True when the merchant exposes /s/<slug>/reviews to customers.
  // Drives whether the "ביקורות" tab/nav-link is visible.
  reviewsPublic?: boolean;
  // Show the "upgrade to XL for ₪Y" banner inside ItemDetail when
  // a larger size exists. Toggled from Settings → Sales (default on).
  upsellSizeNudge?: boolean;
}

interface BranchInfo {
  deliveryFee: number;
  serviceFee: number;
  minOrder: number;
  status: "open" | "busy" | "closed";
  busyEtaBoostMinutes: number;
  freeDeliveryMinOrder?: number | null;
  freeDeliveryMinItems?: number | null;
  hours?: BranchHours | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

function storageKey(tenantSlug: string) {
  return `qf:cart:${tenantSlug}`;
}

export function CartProvider({
  tenant,
  branch,
  zones = [],
  children,
}: {
  tenant: TenantInfo;
  branch: BranchInfo | null;
  /** Active delivery zones - used to resolve per-zone fee/minimum once the
   *  customer has picked a delivery city. */
  zones?: ZoneForMatch[];
  children: React.ReactNode;
}) {
  const [state, setState] = useState<CartState>({ lines: [], method: "delivery", acceptedBundles: [] });
  const [hydrated, setHydrated] = useState(false);
  // The customer's chosen delivery city (localStorage). Re-read on the
  // same-tab change event so the cart's fee/minimum update live.
  const [deliveryCity, setDeliveryCity] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => {
      const choice = readDeliveryChoice(tenant.slug);
      setDeliveryCity(choice?.kind === "delivery" ? choice.city : null);
    };
    sync();
    window.addEventListener(DELIVERY_CHOICE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DELIVERY_CHOICE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [tenant.slug]);

  // Hydrate from localStorage - synchronous setState here is intentional
  // (one-time hydration on mount) and the lint rule does not apply.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(tenant.slug));
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState({
          lines: parsed.lines ?? [],
          method: parsed.method ?? "delivery",
          acceptedBundles: parsed.acceptedBundles ?? [],
        });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, [tenant.slug]);

  // Persist
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(tenant.slug), JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, tenant.slug, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = state.lines.reduce((acc, l) => {
      const opts = l.options.reduce((a, o) => a + o.priceDelta, 0);
      const unit = l.basePrice + l.sizeDelta + opts;
      return acc + unit * l.quantity;
    }, 0);
    const itemCount = state.lines.reduce((acc, l) => acc + l.quantity, 0);
    const bundleDiscount = Math.min(
      subtotal,
      state.acceptedBundles.reduce((acc, b) => acc + Math.max(0, b.savings), 0),
    );

    // Per-zone economics override the branch defaults once the customer is
    // ordering delivery to a city that maps to an active zone. Mirrors the
    // server (orders-create) so the displayed price equals the charge.
    const matchedZone =
      branch && state.method === "delivery"
        ? matchZoneByCity(zones, deliveryCity)
        : null;
    const effectiveBranch: BranchInfo | null = branch
      ? {
          ...branch,
          deliveryFee: matchedZone ? matchedZone.deliveryFee : branch.deliveryFee,
          minOrder:
            matchedZone && matchedZone.minOrder > 0 ? matchedZone.minOrder : branch.minOrder,
          freeDeliveryMinOrder:
            matchedZone && matchedZone.freeDeliveryAbove != null && matchedZone.freeDeliveryAbove > 0
              ? matchedZone.freeDeliveryAbove
              : branch.freeDeliveryMinOrder,
        }
      : null;

    const deliveryFee = effectiveBranch
      ? computeDeliveryFee({
          method: state.method,
          baseFee: effectiveBranch.deliveryFee,
          subtotal,
          itemCount,
          freeMinOrder: effectiveBranch.freeDeliveryMinOrder,
          freeMinItems: effectiveBranch.freeDeliveryMinItems,
        })
      : 0;
    return {
      ...state,
      add: (line) => {
        const lineId = crypto.randomUUID();
        setState((s) => ({ ...s, lines: [...s.lines, { ...line, lineId }] }));
      },
      addMany: (newLines) => {
        if (newLines.length === 0) return;
        const withIds: CartLine[] = newLines.map((l) => ({
          ...l,
          lineId: crypto.randomUUID(),
        }));
        setState((s) => ({ ...s, lines: [...s.lines, ...withIds] }));
      },
      updateLine: (lineId, line) => {
        setState((s) => ({
          ...s,
          lines: s.lines.map((l) => (l.lineId === lineId ? { ...line, lineId } : l)),
        }));
      },
      updateQuantity: (lineId, qty) =>
        setState((s) => ({
          ...s,
          lines:
            qty <= 0
              ? s.lines.filter((l) => l.lineId !== lineId)
              : s.lines.map((l) => (l.lineId === lineId ? { ...l, quantity: qty } : l)),
        })),
      remove: (lineId) =>
        setState((s) => ({ ...s, lines: s.lines.filter((l) => l.lineId !== lineId) })),
      clear: () => setState((s) => ({ ...s, lines: [], acceptedBundles: [] })),
      setMethod: (m) => setState((s) => ({ ...s, method: m })),
      acceptBundle: (id, savings) =>
        setState((s) =>
          s.acceptedBundles.some((b) => b.id === id)
            ? s
            : { ...s, acceptedBundles: [...s.acceptedBundles, { id, savings }] },
        ),
      unacceptBundle: (id) =>
        setState((s) => ({
          ...s,
          acceptedBundles: s.acceptedBundles.filter((b) => b.id !== id),
        })),
      acceptedBundles: state.acceptedBundles,
      bundleDiscount,
      subtotal,
      itemCount,
      deliveryFee,
      deliveryEta: matchedZone ? { min: matchedZone.minEta, max: matchedZone.maxEta } : null,
      tenant,
      branch: effectiveBranch,
      hydrated,
    };
  }, [state, tenant, branch, zones, deliveryCity, hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
