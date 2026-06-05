"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine } from "@/components/customer/CartProvider";

/** Cashier-applied discount. `percent` is 0-100 (whole numbers, e.g. 10 = 10%).
 *  `fixed` is whole shekels. The actual ₪ deduction is computed from the
 *  current subtotal so a percent discount survives line edits. */
type PosDiscount =
  | { mode: "percent"; value: number }
  | { mode: "fixed"; value: number };

/** Cashier-applied tip, same shape as discount but added on top of the
 *  subtotal rather than subtracted. Computed from subtotal so a percent
 *  tip survives line edits. */
type PosTip =
  | { mode: "percent"; value: number }
  | { mode: "fixed"; value: number };

/** A ticket the cashier set aside ("park sale") so they can ring another
 *  customer in between. Lives in localStorage — no DB row — because the
 *  order shouldn't materialize until it's actually paid. */
export interface ParkedTicket {
  id: string;
  label: string;
  parkedAt: number;
  lines: CartLine[];
  customer: PosCartContextValue["customer"];
  notes: string;
  discount: PosDiscount | null;
  tip: PosTip | null;
  /** Cached subtotal at park time — saves recomputing in the recall list. */
  subtotal: number;
}

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
  /** Manual discount picked by the cashier. */
  discount: PosDiscount | null;
  setDiscount: (d: PosDiscount | null) => void;
  /** Concrete ₪ amount derived from `discount` + current subtotal,
   *  already capped at the subtotal. */
  discountAmount: number;
  /** Manual tip picked by the cashier. */
  tip: PosTip | null;
  setTip: (t: PosTip | null) => void;
  /** Concrete ₪ amount derived from `tip` + current subtotal. */
  tipAmount: number;
  /** Final amount the customer owes: subtotal − discount + tip. */
  total: number;
  /** Tickets the cashier set aside via the "החזק" button. */
  parked: ParkedTicket[];
  /** Snapshot the current cart into `parked` and clear the working ticket. */
  park: (label: string) => void;
  /** Move a parked ticket back into the working cart and remove it from
   *  the parked list. If the working cart isn't empty when called the
   *  consumer should confirm with the cashier first (lost work). */
  restoreParked: (id: string) => void;
  /** Drop a parked ticket without restoring it. */
  discardParked: (id: string) => void;
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

function parkedKey(slug: string) {
  return `qf:pos-parked:${slug}`;
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
  discount: PosDiscount | null;
  tip: PosTip | null;
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
  const [discount, setDiscount] = useState<PosDiscount | null>(null);
  const [tip, setTip] = useState<PosTip | null>(null);
  const [parked, setParked] = useState<ParkedTicket[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(tenantSlug));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedShape>;
        if (Array.isArray(parsed.lines)) setLines(parsed.lines);
        if (parsed.customer) setCustomer(parsed.customer);
        if (typeof parsed.notes === "string") setNotes(parsed.notes);
        if (parsed.discount) setDiscount(parsed.discount);
        if (parsed.tip) setTip(parsed.tip);
      }
      const rawParked = window.localStorage.getItem(parkedKey(tenantSlug));
      if (rawParked) {
        const parsedParked = JSON.parse(rawParked) as unknown;
        if (Array.isArray(parsedParked)) setParked(parsedParked as ParkedTicket[]);
      }
    } catch {
      // Corrupt cart — reset rather than block the cashier.
    }
    setHydrated(true);
  }, [tenantSlug]);

  useEffect(() => {
    if (!hydrated) return;
    const payload: PersistedShape = { lines, customer, notes, discount, tip };
    window.localStorage.setItem(storageKey(tenantSlug), JSON.stringify(payload));
  }, [tenantSlug, lines, customer, notes, discount, tip, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(parkedKey(tenantSlug), JSON.stringify(parked));
  }, [tenantSlug, parked, hydrated]);

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

  const discountAmount = useMemo(() => {
    if (!discount || subtotal <= 0) return 0;
    const raw =
      discount.mode === "percent"
        ? Math.floor((subtotal * discount.value) / 100)
        : discount.value;
    return Math.min(Math.max(0, raw), subtotal);
  }, [discount, subtotal]);

  const tipAmount = useMemo(() => {
    if (!tip || subtotal <= 0) return 0;
    const raw =
      tip.mode === "percent"
        ? Math.floor((subtotal * tip.value) / 100)
        : tip.value;
    return Math.max(0, raw);
  }, [tip, subtotal]);

  const total = subtotal - discountAmount + tipAmount;

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
      setDiscount(null);
      setTip(null);
    },
    subtotal,
    itemCount,
    hydrated,
    customer,
    setCustomer,
    notes,
    setNotes,
    discount,
    setDiscount,
    discountAmount,
    tip,
    setTip,
    tipAmount,
    total,
    parked,
    park(label) {
      if (lines.length === 0) return;
      const ticket: ParkedTicket = {
        id: genId(),
        label: label.trim() || new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
        parkedAt: Date.now(),
        lines,
        customer,
        notes,
        discount,
        tip,
        subtotal,
      };
      setParked((prev) => [ticket, ...prev]);
      setLines([]);
      setCustomer(null);
      setNotes("");
      setDiscount(null);
      setTip(null);
    },
    restoreParked(id) {
      const ticket = parked.find((p) => p.id === id);
      if (!ticket) return;
      setLines(ticket.lines);
      setCustomer(ticket.customer);
      setNotes(ticket.notes);
      setDiscount(ticket.discount);
      setTip(ticket.tip ?? null);
      setParked((prev) => prev.filter((p) => p.id !== id));
    },
    discardParked(id) {
      setParked((prev) => prev.filter((p) => p.id !== id));
    },
  };

  return <PosCartContext.Provider value={value}>{children}</PosCartContext.Provider>;
}
