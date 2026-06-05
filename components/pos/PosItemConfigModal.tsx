"use client";

import { useEffect, useMemo, useState } from "react";
import type { CartLine } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { IcoPlus, IcoMinus, IcoClose } from "@/components/shared/Icons";
import { TouchTextarea } from "@/components/shared/TouchInput";

type HalfPlacement = "left" | "right" | "full";

interface Size {
  id: string;
  code: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

interface Option {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  imageUrl?: string | null;
}

interface OptionGroup {
  id: string;
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelect: number;
  maxSelect: number;
  includedFree?: number;
  helpText?: string | null;
  allowHalf?: boolean;
  maxPerSide?: number | null;
  options: Option[];
}

interface FullItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  artType: string | null;
  images?: string[];
  tags?: string[];
  sizes: Size[];
  optionGroups: OptionGroup[];
}

export interface PosItemConfigResult {
  line: Omit<CartLine, "lineId">;
}

interface Props {
  tenantSlug: string;
  itemId: string;
  /** When set, the modal opens in edit mode — prefilled from the line, and
   *  the confirm button reads "עדכן שורה" instead of "הוסף". */
  existingLine?: CartLine;
  onClose: () => void;
  onConfirm: (result: PosItemConfigResult) => void;
}

/**
 * Cashier-side item configuration. Lighter than the customer ItemDetail —
 * no hero image, no upsell, no tags, no description, no AI advisor — just
 * the picker: size, every option group (incl. half-and-half for pizza),
 * notes, quantity, add. Mirrors the customer's pricing math exactly so a
 * POS-rung order totals the same as one rung through the storefront.
 */
export function PosItemConfigModal({
  tenantSlug,
  itemId,
  existingLine,
  onClose,
  onConfirm,
}: Props) {
  const [item, setItem] = useState<FullItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, Set<string>>>({});
  const [halfPicks, setHalfPicks] = useState<Record<string, Record<string, HalfPlacement>>>({});
  const [notes, setNotes] = useState(existingLine?.notes ?? "");
  const [quantity, setQuantity] = useState(existingLine?.quantity ?? 1);
  const [notesOpen, setNotesOpen] = useState((existingLine?.notes ?? "").length > 0);
  const [flashGroupId, setFlashGroupId] = useState<string | null>(null);

  // Load the full item (sizes + option groups). The customer storefront's
  // public menu-item endpoint already returns exactly the shape we need —
  // reuse it as-is rather than maintaining a parallel merchant version.
  useEffect(() => {
    fetch(`/api/v1/customer/menu-item?slug=${encodeURIComponent(tenantSlug)}&id=${encodeURIComponent(itemId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.item) {
          setItem(d.item as FullItem);
        } else {
          setError(d.error ?? "טעינת הפריט נכשלה");
        }
      })
      .catch(() => setError("טעינת הפריט נכשלה"));
  }, [tenantSlug, itemId]);

  // Seed selection state once the item lands. In edit mode we restore the
  // exact picks from the existing line; otherwise we honor the catalog's
  // isDefault flags so the cashier starts at a sensible baseline.
  useEffect(() => {
    if (!item) return;
    // Size
    if (existingLine?.sizeId) {
      setSizeId(existingLine.sizeId);
    } else {
      const def = item.sizes.find((s) => s.isDefault) ?? item.sizes[0] ?? null;
      setSizeId(def?.id ?? null);
    }
    // Picks + half picks
    const nextPicks: Record<string, Set<string>> = {};
    const nextHalfPicks: Record<string, Record<string, HalfPlacement>> = {};
    for (const g of item.optionGroups) {
      if (g.allowHalf) {
        const map: Record<string, HalfPlacement> = {};
        if (existingLine) {
          for (const o of existingLine.options) {
            if (o.groupId === g.id && o.half) map[o.optionId] = o.half;
          }
        } else {
          for (const o of g.options) {
            if (o.isDefault) map[o.id] = "full";
          }
        }
        nextHalfPicks[g.id] = map;
      } else {
        const set = new Set<string>();
        if (existingLine) {
          for (const o of existingLine.options) {
            if (o.groupId === g.id && !o.half) set.add(o.optionId);
          }
        } else {
          for (const o of g.options) {
            if (o.isDefault) set.add(o.id);
          }
        }
        nextPicks[g.id] = set;
      }
    }
    setPicks(nextPicks);
    setHalfPicks(nextHalfPicks);
  }, [item, existingLine]);

  // Required-group validation — same rule as the customer screen.
  const missingGroup = useMemo<OptionGroup | null>(() => {
    if (!item) return null;
    for (const g of item.optionGroups) {
      const floor = g.required ? Math.max(1, g.minSelect) : g.minSelect;
      if (g.allowHalf) {
        const count = Object.keys(halfPicks[g.id] ?? {}).length;
        if (g.required && count < floor) return g;
      } else {
        const sel = picks[g.id] ?? new Set();
        if (g.required && sel.size < floor) return g;
      }
    }
    return null;
  }, [item, picks, halfPicks]);

  const lineTotal = useMemo(() => {
    if (!item) return 0;
    const sDelta = item.sizes.find((s) => s.id === sizeId)?.priceDelta ?? 0;
    let oDelta = 0;
    for (const g of item.optionGroups) {
      if (g.allowHalf) {
        const gHalf = halfPicks[g.id] ?? {};
        const picked = g.options.filter((o) => gHalf[o.id]);
        const paidSorted = picked
          .filter((o) => o.priceDelta > 0)
          .sort((a, b) => a.priceDelta - b.priceDelta);
        const free = g.includedFree ?? 0;
        const freedIds = new Set(paidSorted.slice(0, free).map((o) => o.id));
        for (const o of picked) {
          const placement = gHalf[o.id];
          const baseDelta = freedIds.has(o.id) ? 0 : o.priceDelta;
          oDelta += placement !== "full" ? baseDelta / 2 : baseDelta;
        }
      } else {
        const sel = picks[g.id] ?? new Set();
        const picked = g.options.filter((o) => sel.has(o.id));
        const paidSorted = picked
          .filter((o) => o.priceDelta > 0)
          .sort((a, b) => a.priceDelta - b.priceDelta);
        const free = g.includedFree ?? 0;
        const freedIds = new Set(paidSorted.slice(0, free).map((o) => o.id));
        for (const o of picked) {
          oDelta += freedIds.has(o.id) ? 0 : o.priceDelta;
        }
      }
    }
    return (item.basePrice + sDelta + oDelta) * quantity;
  }, [item, sizeId, picks, halfPicks, quantity]);

  function toggleOption(group: OptionGroup, optionId: string) {
    setPicks((prev) => {
      const next = { ...prev };
      const current = new Set(next[group.id] ?? []);
      if (group.type === "single") {
        next[group.id] = new Set([optionId]);
      } else {
        if (current.has(optionId)) {
          current.delete(optionId);
        } else {
          if (current.size >= group.maxSelect) return prev;
          current.add(optionId);
        }
        next[group.id] = current;
      }
      return next;
    });
  }

  function toggleHalf(group: OptionGroup, optionId: string, placement: HalfPlacement) {
    setHalfPicks((prev) => {
      const gMap = { ...(prev[group.id] ?? {}) };
      const cap = group.maxPerSide ?? null;
      if (gMap[optionId] === placement) {
        delete gMap[optionId];
        return { ...prev, [group.id]: gMap };
      }
      if (cap != null) {
        const nextMap = { ...gMap, [optionId]: placement };
        let left = 0;
        let right = 0;
        for (const p of Object.values(nextMap)) {
          if (p === "left" || p === "full") left += 1;
          if (p === "right" || p === "full") right += 1;
        }
        if (left > cap || right > cap) return prev;
        gMap[optionId] = placement;
      } else {
        const count = Object.keys(gMap).length;
        if (!gMap[optionId] && count >= group.maxSelect) return prev;
        gMap[optionId] = placement;
      }
      return { ...prev, [group.id]: gMap };
    });
  }

  function handleConfirm() {
    if (!item) return;
    if (missingGroup) {
      setFlashGroupId(missingGroup.id);
      const el = document.getElementById(`pos-group-${missingGroup.id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => setFlashGroupId(null), 1200);
      return;
    }
    const size = item.sizes.find((s) => s.id === sizeId);
    const selectedOpts: CartLine["options"] = [];
    for (const g of item.optionGroups) {
      if (g.allowHalf) {
        const gHalf = halfPicks[g.id] ?? {};
        const picked = g.options.filter((o) => gHalf[o.id]);
        const paidSorted = picked
          .filter((o) => o.priceDelta > 0)
          .sort((a, b) => a.priceDelta - b.priceDelta);
        const free = g.includedFree ?? 0;
        const freedIds = new Set(paidSorted.slice(0, free).map((o) => o.id));
        for (const o of picked) {
          const placement = gHalf[o.id]!;
          const baseDelta = freedIds.has(o.id) ? 0 : o.priceDelta;
          const effectiveDelta = placement !== "full" ? baseDelta / 2 : baseDelta;
          selectedOpts.push({
            groupId: g.id,
            optionId: o.id,
            name: o.name,
            groupName: g.name,
            priceDelta: effectiveDelta,
            half: placement,
          });
        }
      } else {
        const sel = picks[g.id] ?? new Set();
        const picked = g.options.filter((o) => sel.has(o.id));
        const paidSorted = picked
          .filter((o) => o.priceDelta > 0)
          .sort((a, b) => a.priceDelta - b.priceDelta);
        const free = g.includedFree ?? 0;
        const freedIds = new Set(paidSorted.slice(0, free).map((o) => o.id));
        for (const o of picked) {
          const baseDelta = freedIds.has(o.id) ? 0 : o.priceDelta;
          selectedOpts.push({
            groupId: g.id,
            optionId: o.id,
            name: o.name,
            groupName: g.name,
            priceDelta: baseDelta,
          });
        }
      }
    }
    onConfirm({
      line: {
        itemId: item.id,
        name: item.name,
        basePrice: item.basePrice,
        artType: item.artType,
        imageUrl: item.images?.[0] ?? null,
        quantity,
        sizeId: size?.id ?? null,
        sizeName: size?.name ?? null,
        sizeDelta: size?.priceDelta ?? 0,
        options: selectedOpts,
        notes: notes.trim() || null,
        source: existingLine?.source ?? "menu",
      },
    });
  }

  if (error) {
    return (
      <Shell onClose={onClose}>
        <div className="p-8 text-center text-qf-tomato">{error}</div>
      </Shell>
    );
  }
  if (!item) {
    return (
      <Shell onClose={onClose}>
        <div className="p-8 text-center text-qf-mute">טוען פריט...</div>
      </Shell>
    );
  }

  const sizeHidden = item.sizes.length <= 1;
  return (
    <Shell onClose={onClose}>
      <header className="border-b-2 border-black px-5 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black truncate">{item.name}</h2>
          <p className="text-xs text-qf-mute mt-0.5">
            מחיר בסיס {formatPrice(item.basePrice)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full grid place-items-center hover:bg-qf-line-soft shrink-0"
          aria-label="סגור"
        >
          <IcoClose s={16} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
        {!sizeHidden && (
          <section>
            <SectionTitle title="גודל" required />
            <div className="flex flex-wrap gap-2">
              {item.sizes.map((s) => (
                <Chip
                  key={s.id}
                  active={sizeId === s.id}
                  onClick={() => setSizeId(s.id)}
                >
                  <span>{s.name}</span>
                  {s.priceDelta !== 0 && (
                    <span className="text-xs opacity-70 tnum ms-1">
                      {s.priceDelta > 0 ? "+" : ""}
                      {formatPrice(s.priceDelta)}
                    </span>
                  )}
                </Chip>
              ))}
            </div>
          </section>
        )}

        {item.optionGroups.map((g) => {
          if (g.allowHalf) {
            const gHalf = halfPicks[g.id] ?? {};
            const cap = g.maxPerSide ?? null;
            let leftCount = 0;
            let rightCount = 0;
            for (const p of Object.values(gHalf)) {
              if (p === "left" || p === "full") leftCount += 1;
              if (p === "right" || p === "full") rightCount += 1;
            }
            const totalDistinct = Object.keys(gHalf).length;
            const atMax =
              cap != null
                ? leftCount >= cap && rightCount >= cap
                : totalDistinct >= g.maxSelect;
            const subtitle =
              cap != null
                ? `צד א׳: ${leftCount}/${cap} · צד ב׳: ${rightCount}/${cap}`
                : `${totalDistinct}/${g.maxSelect} · ניתן לבחור חצי`;
            return (
              <section
                id={`pos-group-${g.id}`}
                key={g.id}
                className={cn(
                  flashGroupId === g.id &&
                    "ring-2 ring-qf-tomato rounded-2xl p-2 -m-2 transition-shadow",
                )}
              >
                <SectionTitle title={g.name} required={g.required} subtitle={subtitle} />
                <div className="space-y-1.5">
                  {g.options.map((o) => {
                    const placement = gHalf[o.id];
                    const halfPrice = o.priceDelta / 2;
                    const wouldExceed = (p: HalfPlacement) => {
                      if (cap == null) return false;
                      if (placement === p) return false;
                      let l = leftCount;
                      let r = rightCount;
                      if (placement === "left" || placement === "full") l -= 1;
                      if (placement === "right" || placement === "full") r -= 1;
                      if (p === "left" || p === "full") l += 1;
                      if (p === "right" || p === "full") r += 1;
                      return l > cap || r > cap;
                    };
                    const rowBlocked = !placement && atMax;
                    return (
                      <div
                        key={o.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl border border-qf-line bg-white",
                          rowBlocked && "opacity-40",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{o.name}</div>
                          {o.priceDelta > 0 && (
                            <div className="text-[11px] text-qf-mute tnum">
                              שלם +{formatPrice(o.priceDelta)} · חצי +{formatPrice(halfPrice)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(["left", "full", "right"] as HalfPlacement[]).map((p) => {
                            const blocked = rowBlocked ? placement !== p : wouldExceed(p);
                            const label =
                              p === "left" ? "חצי א׳" : p === "right" ? "חצי ב׳" : "שלם";
                            return (
                              <button
                                key={p}
                                type="button"
                                disabled={blocked}
                                onClick={() => !blocked && toggleHalf(g, o.id, p)}
                                title={label}
                                aria-label={label}
                                className={cn(
                                  "w-8 h-8 rounded-full border-2 grid place-items-center transition",
                                  placement === p
                                    ? "border-(--qf-primary) text-(--qf-primary) bg-(--qf-soft)"
                                    : "border-qf-line-dash text-qf-ink2 bg-white hover:border-(--qf-primary)",
                                  blocked && "opacity-40 cursor-not-allowed",
                                )}
                              >
                                <HalfIcon side={p} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          }

          const selected = picks[g.id] ?? new Set<string>();
          const subtitle =
            g.type === "single"
              ? "בחירה אחת"
              : `${selected.size}/${g.maxSelect}${g.includedFree ? ` · ${g.includedFree} חינם` : ""}`;
          const atMax = g.type === "multi" && selected.size >= g.maxSelect;
          return (
            <section
              id={`pos-group-${g.id}`}
              key={g.id}
              className={cn(
                flashGroupId === g.id &&
                  "ring-2 ring-qf-tomato rounded-2xl p-2 -m-2 transition-shadow",
              )}
            >
              <SectionTitle title={g.name} required={g.required} subtitle={subtitle} />
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const active = selected.has(o.id);
                  const blocked = !active && atMax;
                  return (
                    <Chip
                      key={o.id}
                      active={active}
                      blocked={blocked}
                      onClick={() => !blocked && toggleOption(g, o.id)}
                    >
                      <span>{o.name}</span>
                      {o.priceDelta !== 0 && (
                        <span className="text-xs opacity-70 tnum ms-1">
                          {o.priceDelta > 0 ? "+" : ""}
                          {formatPrice(o.priceDelta)}
                        </span>
                      )}
                    </Chip>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section>
          {!notesOpen ? (
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="text-sm font-bold text-(--qf-deep) underline"
            >
              + הוסף הערה לפריט
            </button>
          ) : (
            <>
              <SectionTitle title="הערה לפריט" />
              <TouchTextarea
                value={notes}
                onChange={setNotes}
                maxLength={200}
                rows={2}
                placeholder="לדוגמה: בלי בצל, חתוך ל-2, חם מאוד"
                className="w-full px-3 py-2 rounded-xl border-2 border-qf-line-dash text-sm focus:border-(--qf-primary) outline-none resize-none"
              />
            </>
          )}
        </section>
      </div>

      {/* Footer: qty + total + add */}
      <footer className="border-t-2 border-black px-5 py-4 bg-qf-bg/40 flex items-center gap-3">
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="w-10 h-10 rounded-xl bg-white border-2 border-black grid place-items-center shadow-[0_2px_0_#000]"
            aria-label="הפחת"
          >
            <IcoMinus s={14} c="#000" />
          </button>
          <span className="w-9 text-center tnum text-lg font-black">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            className="w-10 h-10 rounded-xl bg-white border-2 border-black grid place-items-center shadow-[0_2px_0_#000]"
            aria-label="הוסף"
          >
            <IcoPlus s={14} c="#000" />
          </button>
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          className={cn(
            "flex-1 h-14 rounded-2xl border-2 border-black font-black text-base shadow-[0_3px_0_#000] flex items-center justify-between px-5",
            missingGroup ? "bg-qf-yolk-soft text-qf-ink" : "bg-black text-[#F8CB1E] hover:bg-black/90",
          )}
        >
          <span>
            {missingGroup
              ? `בחר ${missingGroup.name}`
              : existingLine
                ? "עדכן שורה"
                : "הוסף לכרטיסייה"}
          </span>
          <span className="tnum">{formatPrice(lineTotal)}</span>
        </button>
      </footer>
    </Shell>
  );
}

function SectionTitle({
  title,
  required,
  subtitle,
}: {
  title: string;
  required?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-black">{title}</h3>
        {required && (
          <span className="text-[10px] bg-qf-tomato-soft text-qf-tomato font-bold px-1.5 py-0.5 rounded">
            חובה
          </span>
        )}
      </div>
      {subtitle && <span className="text-[11px] text-qf-mute">{subtitle}</span>}
    </div>
  );
}

function Chip({
  active,
  blocked,
  onClick,
  children,
}: {
  active: boolean;
  blocked?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={blocked}
      className={cn(
        "px-3.5 py-2 rounded-xl border-2 text-sm font-bold transition inline-flex items-center",
        active
          ? "bg-(--qf-soft) border-(--qf-primary) text-(--qf-deep) shadow-[0_2px_0_var(--qf-primary)]"
          : "bg-white border-qf-line-dash text-qf-ink hover:border-(--qf-primary)/60",
        blocked && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function HalfIcon({ side }: { side: HalfPlacement }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {side === "full" && <circle cx="8" cy="8" r="6" fill="currentColor" />}
      {side === "left" && (
        <path d="M 8 2 A 6 6 0 0 1 8 14 Z" fill="currentColor" />
      )}
      {side === "right" && (
        <path d="M 8 2 A 6 6 0 0 0 8 14 Z" fill="currentColor" />
      )}
    </svg>
  );
}

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 pb-[var(--qf-kbd-h,1rem)]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] flex flex-col overflow-hidden animate-qf-check-in"
      >
        {children}
      </div>
    </div>
  );
}
