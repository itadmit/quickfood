"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoClose, IcoPlus, IcoMinus } from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface MenuItem {
  id: string;
  name: string;
  basePrice: number;
  artType: string | null;
  available: boolean;
  sizes: Array<{ id: string; name: string; priceDelta: number; isDefault: boolean }>;
}

interface Category {
  id: string;
  name: string;
}

interface CartLine {
  itemId: string;
  name: string;
  qty: number;
  unit: number;
}

export function ManualOrderModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [cart, setCart] = useState<Record<string, CartLine>>({});

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<"cash" | "card">("cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/merchant/menu/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []));
    // For items + sizes, reuse the public restaurant menu endpoint
    fetch("/api/v1/merchant/tenant")
      .then((r) => r.json())
      .then(async (d) => {
        const slug = d.tenant?.slug;
        if (!slug) return;
        const menu = await fetch(`/api/v1/restaurants/${slug}/menu`).then((r) => r.json());
        setItems(
          (menu.items as Array<Record<string, unknown>>).map((it) => ({
            id: it.id as string,
            name: it.name as string,
            basePrice: it.base_price as number,
            artType: it.art_type as string | null,
            available: it.available as boolean,
            sizes: ((it.sizes as Array<Record<string, unknown>>) ?? []).map((s) => ({
              id: s.id as string,
              name: s.name as string,
              priceDelta: s.price_delta as number,
              isDefault: s.is_default as boolean,
            })),
          })),
        );
      });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function addItem(item: MenuItem) {
    const defaultSize = item.sizes.find((s) => s.isDefault);
    const unit = item.basePrice + (defaultSize?.priceDelta ?? 0);
    setCart((c) => {
      const existing = c[item.id];
      return {
        ...c,
        [item.id]: existing
          ? { ...existing, qty: existing.qty + 1 }
          : { itemId: item.id, name: item.name, qty: 1, unit },
      };
    });
  }

  function changeQty(itemId: string, delta: number) {
    setCart((c) => {
      const existing = c[itemId];
      if (!existing) return c;
      const next = existing.qty + delta;
      if (next <= 0) {
        const rest = { ...c };
        delete rest[itemId];
        return rest;
      }
      return { ...c, [itemId]: { ...existing, qty: next } };
    });
  }

  const lines = Object.values(cart);
  const subtotal = lines.reduce((acc, l) => acc + l.qty * l.unit, 0);

  const filtered =
    activeCat === "all"
      ? items
      : items.filter((it) => it.id); // no category filter (the merchant menu endpoint doesn't expose categoryId here)

  async function submit() {
    if (!name || !phone || lines.length === 0) {
      setError("חובה: שם, טלפון, ולפחות פריט אחד");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/orders/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer_phone: phone,
          customer_name: name,
          method,
          address: method === "delivery" ? address : undefined,
          payment_method: payment,
          notes: notes || undefined,
          lines: lines.map((l) => ({ item_id: l.itemId, quantity: l.qty })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "יצירה נכשלה");
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-qf-line-soft flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">הזמנה ידנית</h2>
            <p className="text-xs text-qf-mute">למשל טלפונית או בשולחן</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-qf-line-soft grid place-items-center"
            aria-label="סגור"
          >
            <IcoClose s={16} />
          </button>
        </header>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_320px] overflow-hidden">
          {/* Items picker */}
          <div className="overflow-y-auto p-4 border-e border-qf-line-soft">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-3">
              <Chip active={activeCat === "all"} onClick={() => setActiveCat("all")}>
                הכל
              </Chip>
              {categories.map((c) => (
                <Chip
                  key={c.id}
                  active={activeCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                >
                  {c.name}
                </Chip>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => addItem(it)}
                  disabled={!it.available}
                  className="text-start bg-white border border-qf-line-dash rounded-xl p-2.5 hover:border-(--qf-primary) hover:bg-qf-line-soft disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-sm font-medium leading-tight">{it.name}</div>
                  <div className="text-xs text-qf-mute tnum">{formatPrice(it.basePrice)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart + customer */}
          <div className="overflow-y-auto p-4 space-y-3 bg-qf-line-soft/30">
            <div className="space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם הלקוח"
                className="w-full px-3 py-2 rounded-lg border border-qf-line-dash text-sm"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="טלפון"
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg border border-qf-line-dash text-sm"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <Pill active={method === "pickup"} onClick={() => setMethod("pickup")}>
                  איסוף
                </Pill>
                <Pill active={method === "delivery"} onClick={() => setMethod("delivery")}>
                  משלוח
                </Pill>
              </div>
              {method === "delivery" && (
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="כתובת"
                  className="w-full px-3 py-2 rounded-lg border border-qf-line-dash text-sm"
                />
              )}
              <div className="grid grid-cols-2 gap-1.5">
                <Pill active={payment === "cash"} onClick={() => setPayment("cash")}>
                  מזומן
                </Pill>
                <Pill active={payment === "card"} onClick={() => setPayment("card")}>
                  כרטיס
                </Pill>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="הערות"
                className="w-full px-3 py-2 rounded-lg border border-qf-line-dash text-sm"
              />
            </div>

            <hr className="border-qf-line-dash" />

            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-qf-mute">סל ({lines.length})</div>
              {lines.length === 0 ? (
                <div className="text-xs text-qf-mute py-3 text-center">הוסף פריטים מהרשימה</div>
              ) : (
                lines.map((l) => (
                  <div
                    key={l.itemId}
                    className="bg-white rounded-lg border border-qf-line-dash p-2 flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{l.name}</div>
                      <div className="text-xs text-qf-mute tnum">
                        {formatPrice(l.unit)} × {l.qty} = {formatPrice(l.unit * l.qty)}
                      </div>
                    </div>
                    <div className="flex items-center bg-qf-line-soft rounded-full">
                      <button
                        type="button"
                        onClick={() => changeQty(l.itemId, -1)}
                        className="w-6 h-6 grid place-items-center"
                        aria-label="הפחת"
                      >
                        <IcoMinus s={12} />
                      </button>
                      <div className="w-5 text-center text-xs font-semibold tnum">{l.qty}</div>
                      <button
                        type="button"
                        onClick={() => changeQty(l.itemId, 1)}
                        className="w-6 h-6 grid place-items-center"
                        aria-label="הוסף"
                      >
                        <IcoPlus c="#11231a" s={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {error && (
              <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-xs rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-qf-line-soft flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-qf-mute">סה״כ: </span>
            <span className="font-bold tnum">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!name || !phone || lines.length === 0 || busy}
              className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
            >
              {busy ? "יוצר..." : "צור הזמנה"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs whitespace-nowrap border",
        active ? "bg-(--qf-primary) text-white border-transparent" : "bg-white border-qf-line-dash text-qf-ink2",
      )}
    >
      {children}
    </button>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "py-2 rounded-lg border text-sm transition",
        active ? "bg-(--qf-primary) text-white border-transparent" : "bg-white border-qf-line-dash text-qf-ink2",
      )}
    >
      {children}
    </button>
  );
}
