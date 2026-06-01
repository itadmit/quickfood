"use client";

import { cn } from "@/lib/cn";
import { IcoClose } from "@/components/shared/Icons";

// Standard Israeli QWERTY layout. Each row is the visual row from the
// physical keyboard, left-to-right; we render with `dir="ltr"` on the
// row containers so the order matches what users learned on their
// laptops even though the rest of the kiosk is RTL.
const ROW_1 = ["ק", "ר", "א", "ט", "ו", "ן", "ם", "פ"];
const ROW_2 = ["ש", "ד", "ג", "כ", "ע", "י", "ח", "ל", "ך", "ף"];
const ROW_3 = ["ז", "ס", "ב", "ה", "נ", "מ", "צ", "ת", "ץ"];
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

export function KioskKeyboard({
  value,
  onChange,
  onClose,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  className?: string;
}) {
  function append(ch: string) {
    if (value.length >= 40) return;
    onChange(value + ch);
  }
  function backspace() {
    onChange(value.slice(0, -1));
  }
  function clear() {
    onChange("");
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 bg-white border-t border-qf-line-soft shadow-[0_-12px_40px_rgba(17,35,26,0.12)] animate-qf-sheet-in",
        className,
      )}
    >
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-2">
        <div className="flex items-center justify-between gap-3 pb-1">
          <div className="text-xs font-bold tracking-[0.18em] text-qf-mute uppercase">
            מקלדת
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={clear}
              disabled={value.length === 0}
              className="h-9 px-3.5 rounded-lg text-sm font-bold text-qf-mute hover:text-qf-ink hover:bg-qf-line-soft disabled:opacity-40 transition"
            >
              נקה
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg grid place-items-center text-qf-mute hover:text-qf-ink hover:bg-qf-line-soft transition"
              aria-label="סגור מקלדת"
            >
              <IcoClose s={18} />
            </button>
          </div>
        </div>

        {/* Digits — narrow row at the top, separate from letters */}
        <KeyRow keys={DIGITS} onPress={append} compact />
        {/* Letters */}
        <KeyRow keys={ROW_1} onPress={append} />
        <KeyRow keys={ROW_2} onPress={append} />
        <div className="flex items-center gap-1.5" dir="ltr">
          <KeyButton wide onPress={backspace} ariaLabel="מחק">
            <BackspaceGlyph />
          </KeyButton>
          {ROW_3.map((k) => (
            <KeyButton key={k} onPress={() => append(k)}>
              {k}
            </KeyButton>
          ))}
          <KeyButton
            wide
            tone="primary"
            onPress={onClose}
            ariaLabel="סיים"
          >
            סיום
          </KeyButton>
        </div>
        <div className="flex items-center gap-1.5">
          <KeyButton
            extraWide
            onPress={() => append(" ")}
            ariaLabel="רווח"
          >
            רווח
          </KeyButton>
        </div>
      </div>
    </div>
  );
}

function KeyRow({
  keys,
  onPress,
  compact,
}: {
  keys: string[];
  onPress: (ch: string) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5" dir="ltr">
      {keys.map((k) => (
        <KeyButton key={k} compact={compact} onPress={() => onPress(k)}>
          {k}
        </KeyButton>
      ))}
    </div>
  );
}

function KeyButton({
  children,
  onPress,
  ariaLabel,
  wide,
  extraWide,
  compact,
  tone = "default",
}: {
  children: React.ReactNode;
  onPress: () => void;
  ariaLabel?: string;
  wide?: boolean;
  extraWide?: boolean;
  compact?: boolean;
  tone?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={ariaLabel}
      className={cn(
        "flex-1 h-14 rounded-xl border text-xl font-bold transition active:scale-[0.96] active:shadow-none shadow-[0_2px_0_rgba(17,35,26,0.08)]",
        compact && "h-11 text-lg",
        wide && "min-w-[110px] grow-[2] text-base",
        extraWide && "w-full text-base font-semibold",
        tone === "primary"
          ? "bg-(--qf-primary) text-white border-(--qf-deep) hover:bg-(--qf-deep)"
          : "bg-white text-qf-ink border-qf-line-soft hover:bg-qf-line-soft",
      )}
    >
      {children}
    </button>
  );
}

function BackspaceGlyph() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="mx-auto"
    >
      <path
        d="M9 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-7-7 7-7z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M13 9l5 6M18 9l-5 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
