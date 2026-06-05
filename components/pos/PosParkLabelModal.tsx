"use client";

import { useState } from "react";
import { TouchInput } from "@/components/shared/TouchInput";

interface Props {
  onCancel: () => void;
  onConfirm: (label: string) => void;
}

/**
 * Tiny prompt the cashier sees after tapping "החזק" on a ticket. The
 * label is optional — leaving it blank uses the current time as the
 * default so the parked-tickets list still has something to read.
 */
export function PosParkLabelModal({ onCancel, onConfirm }: Props) {
  const [label, setLabel] = useState("");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 pb-[var(--qf-kbd-h,1rem)]"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-6 animate-qf-check-in"
      >
        <h2 className="text-xl font-black text-center">החזק כרטיסייה</h2>
        <p className="text-sm text-qf-mute text-center mt-1">
          תן שם לכרטיסייה כדי שתזהה אותה ברשימת המוחזקות.
        </p>

        <div className="mt-5">
          <label className="block text-sm font-bold mb-1.5">
            שם הכרטיסייה
            <span className="text-qf-mute font-normal"> (אופציונלי)</span>
          </label>
          <TouchInput
            value={label}
            onChange={setLabel}
            maxLength={40}
            autoFocus
            placeholder="לדוגמה: שולחן 4 / דני / זוג בחוץ"
            className="w-full px-3 py-2.5 rounded-xl border-2 border-qf-line-dash focus:border-(--qf-primary) outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="h-12 rounded-2xl bg-white border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/5"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => onConfirm(label)}
            className="h-12 rounded-2xl bg-black text-[#F8CB1E] border-2 border-black font-bold text-sm shadow-[0_2px_0_#000] hover:bg-black/90"
          >
            החזק
          </button>
        </div>
      </div>
    </div>
  );
}
