"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/cn";

interface PosNumericKeypadProps {
  /** Title above the display. */
  title: string;
  /** Confirm label. */
  confirmLabel?: string;
  /** Cancel label. */
  cancelLabel?: string;
  /** Initial accumulator value in shekels. */
  initial?: number;
  /** When >0, hide confirm until typedAmount >= floor (used for change calc). */
  floor?: number;
  /** Quick-amount chips shown above the keypad. */
  quickAmounts?: number[];
  /** Live readout below the display (e.g. עודף). */
  liveCaption?: (typed: number) => { text: string; tone: "muted" | "green" | "red" };
  /** Disable confirm via a custom predicate (e.g. typed < floor). */
  confirmDisabled?: (typed: number) => boolean;
  onCancel: () => void;
  onConfirm: (typed: number) => void;
}

/**
 * Accumulating numeric keypad. The "C" key clears, "←" deletes the last
 * digit. Typing `1` `0` `5` yields 105 (shekels — POS does not split agorot).
 * Quick-amount chips jump straight to a value without going through the
 * keypad. Confirm fires the parent callback with the typed integer.
 */
export function PosNumericKeypadModal({
  title,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  initial = 0,
  quickAmounts = [],
  liveCaption,
  confirmDisabled,
  onCancel,
  onConfirm,
}: PosNumericKeypadProps) {
  const [typed, setTyped] = useState<number>(initial);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") {
        if (confirmDisabled?.(typed) !== true) onConfirm(typed);
      }
      if (e.key === "Backspace") {
        setTyped((t) => Math.floor(t / 10));
      }
      if (/^[0-9]$/.test(e.key)) {
        const d = Number(e.key);
        setTyped((t) => Math.min(t * 10 + d, 999_999));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [typed, confirmDisabled, onCancel, onConfirm]);

  const caption = liveCaption?.(typed);
  const disabled = confirmDisabled ? confirmDisabled(typed) : typed <= 0;

  function press(d: number) {
    setTyped((t) => Math.min(t * 10 + d, 999_999));
  }
  function pressBack() {
    setTyped((t) => Math.floor(t / 10));
  }
  function pressClear() {
    setTyped(0);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-5 animate-qf-check-in"
      >
        <h2 className="text-lg font-black text-center mb-3">{title}</h2>

        <div className="rounded-2xl bg-qf-bg/40 border-2 border-qf-line-dash p-4 mb-3 text-center">
          <div className="text-4xl font-black tnum">₪{typed.toLocaleString("he-IL")}</div>
          {caption && (
            <div
              className={cn(
                "text-sm font-bold mt-1",
                caption.tone === "muted" && "text-qf-mute",
                caption.tone === "green" && "text-qf-green-deep",
                caption.tone === "red" && "text-qf-tomato",
              )}
            >
              {caption.text}
            </div>
          )}
        </div>

        {quickAmounts.length > 0 && (
          <div dir="ltr" className="grid grid-cols-3 gap-2 mb-3">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setTyped(amt)}
                className="px-3 py-2.5 rounded-xl bg-white border-2 border-black font-bold tnum text-base shadow-[0_2px_0_#000] hover:bg-black/5"
              >
                ₪{amt}
              </button>
            ))}
          </div>
        )}

        {/* dir=ltr so 1-2-3 reads left-to-right like a calculator/phone
            even though the surrounding page is RTL. Backspace lives on
            the left next to 0, clear on the right — keeps muscle-memory
            from common POS terminals. */}
        <div dir="ltr" className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <KeyButton key={d} onClick={() => press(d)}>
              {d}
            </KeyButton>
          ))}
          <KeyButton onClick={pressBack} tone="warn">
            ←
          </KeyButton>
          <KeyButton onClick={() => press(0)}>0</KeyButton>
          <KeyButton onClick={pressClear} tone="warn">
            C
          </KeyButton>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3 rounded-2xl bg-white border-2 border-black font-bold text-base shadow-[0_2px_0_#000] hover:bg-black/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(typed)}
            disabled={disabled}
            className="px-5 py-3 rounded-2xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-base shadow-[0_2px_0_#000] hover:bg-black/90 disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function KeyButton({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "warn";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-14 rounded-2xl border-2 border-black font-black text-xl shadow-[0_2px_0_#000] active:translate-y-0.5 transition",
        tone === "warn"
          ? "bg-qf-tomato-soft text-qf-tomato"
          : "bg-white text-black hover:bg-black/5",
      )}
    >
      {children}
    </button>
  );
}

export interface CashKeypadProps {
  total: number;
  onCancel: () => void;
  onConfirm: (received: number, change: number) => void;
}

/**
 * Cash payment variant: total at top, accumulator + quick-amount chips
 * derived from the total, live עודף readout. Confirm disabled while
 * `received < total`.
 */
export function PosCashKeypadModal({ total, onCancel, onConfirm }: CashKeypadProps) {
  const quick = quickAmountsFor(total);
  return (
    <PosNumericKeypadModal
      title={`קבלת מזומן · סה״כ ₪${total.toLocaleString("he-IL")}`}
      confirmLabel="אישור תשלום"
      quickAmounts={quick}
      liveCaption={(typed) => {
        if (typed < total) {
          return { text: `חסר ₪${(total - typed).toLocaleString("he-IL")}`, tone: "red" };
        }
        if (typed === total) {
          return { text: "ללא עודף", tone: "muted" };
        }
        return {
          text: `עודף ₪${(typed - total).toLocaleString("he-IL")}`,
          tone: "green",
        };
      }}
      confirmDisabled={(typed) => typed < total}
      onCancel={onCancel}
      onConfirm={(typed) => onConfirm(typed, Math.max(0, typed - total))}
    />
  );
}

/** Round-up chips: exact, next round-50, next round-100. Deduped + sorted. */
function quickAmountsFor(total: number): number[] {
  const exact = total;
  const next50 = Math.ceil(total / 50) * 50;
  const next100 = Math.ceil(total / 100) * 100;
  return Array.from(new Set([exact, next50, next100])).sort((a, b) => a - b);
}
