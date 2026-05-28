"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
  /** How this line landed in the cart — powers the merchant analytics
   *  breakdown of channel performance. Defaults to "menu" so old carts
   *  in localStorage stay valid. */
  source?: CartLineSource;
}

export interface CartState {
  lines: CartLine[];
  method: "delivery" | "pickup";
}

interface CartContextValue extends CartState {
  add: (line: Omit<CartLine, "lineId">) => void;
  addMany: (lines: Array<Omit<CartLine, "lineId">>) => void;
  updateLine: (lineId: string, line: Omit<CartLine, "lineId">) => void;
  updateQuantity: (lineId: string, qty: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  setMethod: (m: "delivery" | "pickup") => void;
  subtotal: number;
  itemCount: number;
  tenant: TenantInfo;
  branch: BranchInfo | null;
  /** True once localStorage has been read on mount. Until then,
   * `lines` may transiently look empty even when a cart exists — consumers
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
}

interface BranchInfo {
  deliveryFee: number;
  serviceFee: number;
  minOrder: number;
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
  children,
}: {
  tenant: TenantInfo;
  branch: BranchInfo | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<CartState>({ lines: [], method: "delivery" });
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage — synchronous setState here is intentional
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
      clear: () => setState((s) => ({ ...s, lines: [] })),
      setMethod: (m) => setState((s) => ({ ...s, method: m })),
      subtotal,
      itemCount,
      tenant,
      branch,
      hydrated,
    };
  }, [state, tenant, branch, hydrated]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
