"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { TouchInput } from "@/components/shared/TouchInput";

interface Props {
  /** Subtitle shown above the form — typically the total being charged. */
  amountLabel: string;
  onCancel: () => void;
  onConfirm: (data: { name: string; phone?: string }) => void;
}

/**
 * Lightweight prompt that fires before the Grow wallet opens for a card
 * payment with no attached customer. Grow's production endpoint refuses
 * to set up a wallet with placeholder customer fields, and tax invoices
 * later need a real name — so we collect the walk-in's name (required)
 * and phone (optional but preferred). Data is snapshotted onto the
 * order; no Customer row is created (cashier-side fallback only).
 */
export function PosWalkInPromptModal({ amountLabel, onCancel, onConfirm }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    onConfirm({
      name: trimmed,
      phone: phone.trim() || undefined,
    });
  }

  const canSubmit = name.trim().length >= 2;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-6 animate-qf-check-in"
      >
        <h2 className="text-xl font-black text-center">פרטי הלקוח</h2>
        <p className="text-sm text-qf-mute text-center mt-1">
          לתשלום אשראי בסך {amountLabel}
        </p>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-sm font-bold">
              שם הלקוח <span className="text-qf-tomato">*</span>
            </span>
            <TouchInput
              value={name}
              onChange={setName}
              maxLength={60}
              autoFocus
              placeholder="לדוגמה: יוסי כהן"
              className="mt-1 w-full px-3 py-2.5 rounded-xl border-2 border-qf-line-dash focus:border-(--qf-primary) outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) submit();
              }}
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold">
              טלפון <span className="text-qf-mute font-normal">(אופציונלי)</span>
            </span>
            <TouchInput
              value={phone}
              onChange={setPhone}
              dir="ltr"
              placeholder="0501234567"
              className="mt-1 w-full px-3 py-2.5 rounded-xl border-2 border-qf-line-dash focus:border-(--qf-primary) outline-none tnum"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit) submit();
              }}
            />
            <span className="text-[11px] text-qf-mute mt-1 block">
              נשמר על ההזמנה לקבלת קבלת מס במייל / SMS בעתיד.
            </span>
          </label>
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
            onClick={submit}
            disabled={!canSubmit}
            className={cn(
              "h-12 rounded-2xl border-2 border-black font-bold text-sm shadow-[0_2px_0_#000]",
              canSubmit
                ? "bg-black text-[#F8CB1E]"
                : "bg-qf-line-soft text-qf-mute cursor-not-allowed",
            )}
          >
            המשך לתשלום
          </button>
        </div>
      </div>
    </div>
  );
}
