"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Mode = "percent" | "fixed";

interface Props {
  subtotal: number;
  current: { mode: Mode; value: number } | null;
  onCancel: () => void;
  onConfirm: (next: { mode: Mode; value: number } | null) => void;
}

/**
 * Cashier-applied discount picker — toggle between % and ₪, type the
 * amount on the keypad, see the live new-total preview. Bounded: percent
 * 0-100, fixed 0-subtotal. Confirming with value=0 clears the discount.
 */
export function PosDiscountModal({ subtotal, current, onCancel, onConfirm }: Props) {
  const [mode, setMode] = useState<Mode>(current?.mode ?? "percent");
  const [typed, setTyped] = useState<number>(current?.value ?? 0);

  const ceiling = mode === "percent" ? 100 : subtotal;
  const clamped = Math.min(typed, ceiling);

  const discountAmount =
    mode === "percent"
      ? Math.floor((subtotal * clamped) / 100)
      : Math.min(clamped, subtotal);
  const newTotal = Math.max(0, subtotal - discountAmount);

  function press(d: number) {
    setTyped((t) => {
      const next = t * 10 + d;
      return next > ceiling ? ceiling : next;
    });
  }
  function pressBack() {
    setTyped((t) => Math.floor(t / 10));
  }
  function pressClear() {
    setTyped(0);
  }

  function confirm() {
    if (clamped <= 0) {
      onConfirm(null);
      return;
    }
    onConfirm({ mode, value: clamped });
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
        <h2 className="text-lg font-black text-center mb-3">הנחה</h2>

        <div className="grid grid-cols-2 gap-2 mb-3" dir="ltr">
          <button
            type="button"
            onClick={() => {
              setMode("percent");
              setTyped(0);
            }}
            className={cn(
              "h-11 rounded-xl border-2 border-black font-bold text-sm shadow-[0_2px_0_#000]",
              mode === "percent" ? "bg-[#F8CB1E]" : "bg-white",
            )}
          >
            אחוזים %
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("fixed");
              setTyped(0);
            }}
            className={cn(
              "h-11 rounded-xl border-2 border-black font-bold text-sm shadow-[0_2px_0_#000]",
              mode === "fixed" ? "bg-[#F8CB1E]" : "bg-white",
            )}
          >
            סכום ₪
          </button>
        </div>

        <div className="rounded-2xl bg-qf-bg/40 border-2 border-qf-line-dash p-4 mb-3 text-center">
          <div className="text-4xl font-black tnum">
            {mode === "percent"
              ? `${clamped}%`
              : `₪${clamped.toLocaleString("he-IL")}`}
          </div>
          <div className="text-xs text-qf-mute mt-1 tnum">
            סה״כ לפני: ₪{subtotal.toLocaleString("he-IL")}
          </div>
          <div className="text-sm font-bold text-qf-green-deep mt-1 tnum">
            הנחה ₪{discountAmount.toLocaleString("he-IL")} · לתשלום ₪
            {newTotal.toLocaleString("he-IL")}
          </div>
        </div>

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
            ביטול
          </button>
          <button
            type="button"
            onClick={confirm}
            className="px-5 py-3 rounded-2xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-base shadow-[0_2px_0_#000] hover:bg-black/90"
          >
            {clamped > 0 ? "החל הנחה" : current ? "הסר הנחה" : "אישור"}
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
