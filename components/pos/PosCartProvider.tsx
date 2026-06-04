"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine } from "@/components/customer/CartProvider";

interface PosCartContextValue {
  lines: CartLine[];
  add: (line: Omit<CartLine, "lineId">) => void;
  updateLine: (lineId: string, line: Omit<CartLine, "lineId">) => void;
  updateQuantity: (lineId: string, qty: number) => void;
  remove: (lineId: string) => void;
  clear: () => void;
  subtotal: number;
  itemCount: number;
  hydrated: boolean;
  /** Attached customer, mirrored into the order when the sale lands. */
  customer: { id: string; name: string; phone: string } | null;
  setCustomer: (c: { id: string; name: string; phone: string } | null) => void;
  /** Free-text notes that go on the order at submission. */
  notes: string;
  setNotes: (s: string) => void;
}

const PosCartContext = createContext<PosCartContextValue | null>(null);

export function usePosCart() {
  const ctx = useContext(PosCartContext);
  if (!ctx) throw new Error("usePosCart must be called inside <PosCartProvider>");
  return ctx;
}

function storageKey(slug: string) {
  return `qf:pos-cart:${slug}`;
}

function genId() {
  // crypto.randomUUID is widely supported on tablet browsers we ship to.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface PersistedShape {
  lines: CartLine[];
  customer: PosCartContextValue["customer"];
  notes: string;
}

export function PosCartProvider({
  tenantSlug,
  children,
}: {
  tenantSlug: string;
  children: React.ReactNode;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<PosCartContextValue["customer"]>(null);
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(tenantSlug));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (Array.isArray(parsed.lines)) setLines(parsed.lines);
        if (parsed.customer) setCustomer(parsed.customer);
        if (typeof parsed.notes === "string") setNotes(parsed.notes);
      }
    } catch {
      // Corrupt cart — reset rather than block the cashier.
    }
    setHydrated(true);
  }, [tenantSlug]);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedShape = { lines, customer, notes };
    window.localStorage.setItem(storageKey(tenantSlug), JSON.stringify(payload));
  }, [tenantSlug, lines, customer, notes, hydrated]);

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const optionsDelta = l.options.reduce(
          (s, o) => s + (o.half && o.half !== "full" ? o.priceDelta / 2 : o.priceDelta),
          0,
        );
        return sum + (l.basePrice + l.sizeDelta + optionsDelta) * l.quantity;
      }, 0),
    [lines],
  );

  const itemCount = useMemo(
    () => lines.reduce((s, l) => s + l.quantity, 0),
    [lines],
  );

  const value: PosCartContextValue = {
    lines,
    add(line) {
      setLines((prev) => [...prev, { ...line, lineId: genId() }]);
    },
    updateLine(lineId, line) {
      setLines((prev) =>
        prev.map((l) => (l.lineId === lineId ? { ...line, lineId } : l)),
      );
    },
    updateQuantity(lineId, qty) {
      setLines((prev) =>
        prev.flatMap((l) =>
          l.lineId === lineId ? (qty <= 0 ? [] : [{ ...l, quantity: qty }]) : [l],
        ),
      );
    },
    remove(lineId) {
      setLines((prev) => prev.filter((l) => l.lineId !== lineId));
    },
    clear() {
      setLines([]);
      setCustomer(null);
      setNotes("");
    },
    subtotal,
    itemCount,
    hydrated,
    customer,
    setCustomer,
    notes,
    setNotes,
  };

  return <PosCartContext.Provider value={value}>{children}</PosCartContext.Provider>;
}
