"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoClose, IcoPlus, IcoMinus, IcoCheck } from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface OptionRow {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

interface OptionGroupRow {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: OptionRow[];
}

interface MenuItem {
  id: string;
  name: string;
  basePrice: number;
  artType: string | null;
  available: boolean;
  sizes: Array<{ id: string; name: string; priceDelta: number; isDefault: boolean }>;
  optionGroups: OptionGroupRow[];
}

interface Category {
  id: string;
  name: string;
}

interface SelectedOption {
  optionId: string;
  name: string;
  priceDelta: number;
}

interface CartLine {
  // Composite key (itemId + variant fingerprint) so two configurations of
  // the same menu item show up as separate lines instead of clobbering
  // each other.
  key: string;
  itemId: string;
  name: string;
  qty: number;
  unit: number;
  sizeId: string | null;
  sizeName: string | null;
  options: SelectedOption[];
}

function variantKey(itemId: string, sizeId: string | null, optionIds: string[]) {
  return [itemId, sizeId ?? "_", ...[...optionIds].sort()].join("|");
}

function needsConfig(item: MenuItem): boolean {
  if (item.sizes.length > 1) return true;
  if (item.optionGroups.some((g) => g.required)) return true;
  // Item has optional groups → merchant might want to add toppings even
  // though they're not required. Open the picker so they can.
  if (item.optionGroups.length > 0) return true;
  return false;
}

function defaultPicks(item: MenuItem): {
  sizeId: string | null;
  selected: Record<string, Set<string>>;
} {
  const defaultSize = item.sizes.find((s) => s.isDefault) ?? item.sizes[0] ?? null;
  const selected: Record<string, Set<string>> = {};
  for (const g of item.optionGroups) {
    const ids = new Set<string>();
    if (g.required) {
      // Auto-pick defaults that are flagged, otherwise the first
      // `minSelect` available options. Merchant can change in the picker.
      const flagged = g.options.filter((o) => o.isDefault);
      if (flagged.length >= g.minSelect) {
        for (const o of flagged.slice(0, g.maxSelect)) ids.add(o.id);
      } else {
        for (const o of g.options.slice(0, Math.max(g.minSelect, flagged.length))) {
          ids.add(o.id);
        }
      }
    } else {
      for (const o of g.options.filter((o) => o.isDefault)) ids.add(o.id);
    }
    selected[g.id] = ids;
  }
  return { sizeId: defaultSize?.id ?? null, selected };
}

function computeUnit(
  item: MenuItem,
  sizeId: string | null,
  selected: Record<string, Set<string>>,
): number {
  const sizeDelta =
    item.sizes.find((s) => s.id === sizeId)?.priceDelta ??
    item.sizes.find((s) => s.isDefault)?.priceDelta ??
    0;
  let optionsDelta = 0;
  for (const g of item.optionGroups) {
    const picks = g.options.filter((o) => selected[g.id]?.has(o.id));
    for (const o of picks) optionsDelta += o.priceDelta;
  }
  return item.basePrice + sizeDelta + optionsDelta;
}

export function ManualOrderModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [configuring, setConfiguring] = useState<MenuItem | null>(null);

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
            optionGroups: ((it.option_groups as Array<Record<string, unknown>>) ?? []).map(
              (g) => ({
                id: g.id as string,
                name: g.name as string,
                type: g.type as "single" | "multi",
                required: g.required as boolean,
                minSelect: g.min_select as number,
                maxSelect: g.max_select as number,
                options: ((g.options as Array<Record<string, unknown>>) ?? []).map((o) => ({
                  id: o.id as string,
                  name: o.name as string,
                  priceDelta: o.price_delta as number,
                  isDefault: o.is_default as boolean,
                })),
              }),
            ),
          })),
        );
      });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (configuring) setConfiguring(null);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, configuring]);

  function clickItem(item: MenuItem) {
    if (needsConfig(item)) {
      setConfiguring(item);
      return;
    }
    addToCart(item, null, {});
  }

  function addToCart(
    item: MenuItem,
    sizeId: string | null,
    selected: Record<string, Set<string>>,
  ) {
    const optionList: SelectedOption[] = [];
    for (const g of item.optionGroups) {
      const picks = g.options.filter((o) => selected[g.id]?.has(o.id));
      for (const o of picks) {
        optionList.push({ optionId: o.id, name: o.name, priceDelta: o.priceDelta });
      }
    }
    const unit = computeUnit(item, sizeId, selected);
    const sizeRow = item.sizes.find((s) => s.id === sizeId) ?? null;
    const k = variantKey(
      item.id,
      sizeId,
      optionList.map((o) => o.optionId),
    );

    setCart((c) => {
      const existing = c[k];
      return {
        ...c,
        [k]: existing
          ? { ...existing, qty: existing.qty + 1 }
          : {
              key: k,
              itemId: item.id,
              name: item.name,
              qty: 1,
              unit,
              sizeId: sizeRow?.id ?? null,
              sizeName: sizeRow?.name ?? null,
              options: optionList,
            },
      };
    });
  }

  function changeQty(key: string, delta: number) {
    setCart((c) => {
      const existing = c[key];
      if (!existing) return c;
      const next = existing.qty + delta;
      if (next <= 0) {
        const rest = { ...c };
        delete rest[key];
        return rest;
      }
      return { ...c, [key]: { ...existing, qty: next } };
    });
  }

  const lines = Object.values(cart);
  const subtotal = lines.reduce((acc, l) => acc + l.qty * l.unit, 0);

  // Merchant menu endpoint doesn't expose category_id on items so we
  // can't filter by category yet. Keep the chip UI for future support.
  const filtered = activeCat === "all" ? items : items;

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
          lines: lines.map((l) => ({
            item_id: l.itemId,
            quantity: l.qty,
            size_id: l.sizeId ?? null,
            option_ids: l.options.map((o) => o.optionId),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(asErrorMessage(data.error?.code, data.error?.message));
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

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_320px] overflow-hidden relative">
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
                  onClick={() => clickItem(it)}
                  disabled={!it.available}
                  className="text-start bg-white border border-qf-line-dash rounded-xl p-2.5 hover:border-(--qf-primary) hover:bg-qf-line-soft disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="text-sm font-medium leading-tight">{it.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-qf-mute tnum">
                      {formatPrice(it.basePrice)}
                    </div>
                    {needsConfig(it) && (
                      <span className="text-[10px] text-qf-mute bg-qf-line-soft rounded px-1.5 py-0.5">
                        בחירה
                      </span>
                    )}
                  </div>
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
                    key={l.key}
                    className="bg-white rounded-lg border border-qf-line-dash p-2 flex items-start gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{l.name}</div>
                      {l.sizeName && (
                        <div className="text-[11px] text-qf-mute truncate">{l.sizeName}</div>
                      )}
                      {l.options.length > 0 && (
                        <div className="text-[11px] text-qf-mute truncate">
                          {l.options.map((o) => o.name).join(" · ")}
                        </div>
                      )}
                      <div className="text-xs text-qf-mute tnum mt-0.5">
                        {formatPrice(l.unit)} × {l.qty} = {formatPrice(l.unit * l.qty)}
                      </div>
                    </div>
                    <div className="flex items-center bg-qf-line-soft rounded-full shrink-0">
                      <button
                        type="button"
                        onClick={() => changeQty(l.key, -1)}
                        className="w-6 h-6 grid place-items-center"
                        aria-label="הפחת"
                      >
                        <IcoMinus s={12} />
                      </button>
                      <div className="w-5 text-center text-xs font-semibold tnum">{l.qty}</div>
                      <button
                        type="button"
                        onClick={() => changeQty(l.key, 1)}
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

          {configuring && (
            <ConfigurePanel
              item={configuring}
              onCancel={() => setConfiguring(null)}
              onConfirm={(sizeId, selected) => {
                addToCart(configuring, sizeId, selected);
                setConfiguring(null);
              }}
            />
          )}
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

function ConfigurePanel({
  item,
  onCancel,
  onConfirm,
}: {
  item: MenuItem;
  onCancel: () => void;
  onConfirm: (sizeId: string | null, selected: Record<string, Set<string>>) => void;
}) {
  const initial = useMemo(() => defaultPicks(item), [item]);
  const [sizeId, setSizeId] = useState<string | null>(initial.sizeId);
  const [selected, setSelected] = useState<Record<string, Set<string>>>(initial.selected);

  function toggleOption(group: OptionGroupRow, optionId: string) {
    setSelected((prev) => {
      const next: Record<string, Set<string>> = {};
      for (const [k, v] of Object.entries(prev)) next[k] = new Set(v);
      const set = new Set(next[group.id] ?? []);
      if (group.type === "single") {
        if (set.has(optionId)) set.delete(optionId);
        else {
          set.clear();
          set.add(optionId);
        }
      } else {
        if (set.has(optionId)) set.delete(optionId);
        else if (set.size < group.maxSelect) set.add(optionId);
      }
      next[group.id] = set;
      return next;
    });
  }

  const unsatisfied = useMemo(
    () =>
      item.optionGroups.filter(
        (g) => g.required && (selected[g.id]?.size ?? 0) < g.minSelect,
      ),
    [item, selected],
  );
  const canConfirm = unsatisfied.length === 0;
  const unit = computeUnit(item, sizeId, selected);

  return (
    <div className="absolute inset-0 bg-white flex flex-col md:rounded-none">
      <header className="px-4 py-3 border-b border-qf-line-soft flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{item.name}</div>
          <div className="text-xs text-qf-mute tnum">{formatPrice(unit)}</div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-8 h-8 rounded-lg hover:bg-qf-line-soft grid place-items-center"
          aria-label="חזרה"
        >
          <IcoClose s={14} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {item.sizes.length > 1 && (
          <section>
            <div className="text-sm font-semibold mb-2">גודל</div>
            <div className="grid grid-cols-2 gap-2">
              {item.sizes.map((s) => (
                <Pill key={s.id} active={sizeId === s.id} onClick={() => setSizeId(s.id)}>
                  <span className="flex items-center justify-between gap-2 w-full">
                    <span>{s.name}</span>
                    <span className="text-xs opacity-80 tnum">
                      {s.priceDelta > 0 ? `+${formatPrice(s.priceDelta)}` : ""}
                    </span>
                  </span>
                </Pill>
              ))}
            </div>
          </section>
        )}

        {item.optionGroups.map((g) => {
          const set = selected[g.id] ?? new Set<string>();
          const required = g.required;
          const limitReached = set.size >= g.maxSelect && g.type === "multi";
          return (
            <section key={g.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">
                  {g.name}{" "}
                  {required ? (
                    <span className="text-xs text-qf-tomato">(חובה)</span>
                  ) : (
                    <span className="text-xs text-qf-mute">(אופציונלי)</span>
                  )}
                </div>
                <div className="text-[11px] text-qf-mute">
                  {g.type === "single"
                    ? "בחירה אחת"
                    : `עד ${g.maxSelect}${g.minSelect > 0 ? `, לפחות ${g.minSelect}` : ""}`}
                </div>
              </div>
              <div className="space-y-1.5">
                {g.options.map((o) => {
                  const checked = set.has(o.id);
                  const disabled = !checked && limitReached;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggleOption(g, o.id)}
                      disabled={disabled}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm",
                        checked
                          ? "border-(--qf-primary) bg-qf-green-soft"
                          : "border-qf-line-dash bg-white hover:border-qf-line",
                        disabled && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "w-4 h-4 grid place-items-center rounded",
                            g.type === "single" ? "rounded-full" : "rounded",
                            checked
                              ? "bg-(--qf-primary) text-white"
                              : "border border-qf-line",
                          )}
                        >
                          {checked && <IcoCheck c="white" s={10} />}
                        </span>
                        <span>{o.name}</span>
                      </span>
                      <span className="text-xs text-qf-mute tnum">
                        {o.priceDelta > 0
                          ? `+${formatPrice(o.priceDelta)}`
                          : o.priceDelta < 0
                          ? formatPrice(o.priceDelta)
                          : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="px-4 py-3 border-t border-qf-line-soft flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-xl border border-qf-line-dash text-sm"
        >
          ביטול
        </button>
        <button
          type="button"
          onClick={() => onConfirm(sizeId, selected)}
          disabled={!canConfirm}
          className="px-4 py-2 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-medium disabled:opacity-60"
          title={
            !canConfirm
              ? `חסר: ${unsatisfied.map((g) => g.name).join(", ")}`
              : undefined
          }
        >
          {canConfirm ? `הוסף לסל · ${formatPrice(unit)}` : "השלם בחירות חובה"}
        </button>
      </footer>
    </div>
  );
}

function asErrorMessage(code: string | undefined, fallback: string | undefined): string {
  const m: Record<string, string> = {
    required_group_missing: "אחד הפריטים דורש בחירת תוספת חובה",
    too_many_in_single_group: "ניתן לבחור רק אפשרות אחת בקבוצה",
    too_many_in_group: "נבחרו יותר אפשרויות מהמותר",
    size_not_found: "הגודל שנבחר לא קיים",
    item_unavailable: "פריט לא זמין",
    invalid_quantity: "כמות לא תקינה",
    min_order_not_met: "לא הגעת לסכום מינימום להזמנה",
    restaurant_closed: "המסעדה סגורה כרגע",
    no_branch: "אין סניף פעיל",
  };
  if (code && m[code]) return m[code];
  return fallback ?? "יצירה נכשלה";
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
