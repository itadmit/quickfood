"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/cn";
import { IcoClose } from "@/components/shared/Icons";

// Standard Israeli QWERTY (he) + US QWERTY (en) flattened to a
// 10-column grid so every key — letters, digits, punctuation,
// backspace — renders at the exact same width (the width of one ל).
// Missing letter slots are filled with `.` / `-` / `,` so a lone key
// never stretches; backspace tucks in at the end of row 4 in a single
// column. The bottom strip carries space (8 columns) + done (2
// columns) so functional keys stay distinct from the letter grid
// without breaking the column rhythm.
type Lang = "he" | "en";

// Both layouts render LTR — the on-screen keyboard mirrors a physical
// Israeli QWERTY where ק sits on the left (mapped to Q) and פ on the
// right (mapped to P), regardless of the document direction. RTL'ing
// the rows would put ק on the right, which is the opposite of every
// keyboard customers have ever touched. Backspace is embedded in the
// row arrays as the `BS` sentinel so it can sit at whatever slot the
// layout needs — in HE we put it at the end of the top letter row
// (where `-` used to be), in EN it stays at the end of the bottom row.
const BS = "⌫";
const LAYOUT: Record<Lang, { rows: string[][] }> = {
  he: {
    rows: [
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      [".", "ק", "ר", "א", "ט", "ו", "ן", "ם", "פ", BS],
      ["ש", "ד", "ג", "כ", "ע", "י", "ח", "ל", "ך", "ף"],
      ["ז", "ס", "ב", "ה", "נ", "מ", "צ", "ת", "ץ", "-"],
    ],
  },
  en: {
    rows: [
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
      ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
      ["a", "s", "d", "f", "g", "h", "j", "k", "l", "."],
      ["z", "x", "c", "v", "b", "n", "m", ",", "-", BS],
    ],
  },
};

export function VirtualKeyboard({
  value,
  onChange,
  onClose,
  className,
  placeholder,
  maxLength = 40,
}: {
  value: string;
  onChange: (next: string) => void;
  onClose: () => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  const [lang, setLang] = useState<Lang>("he");
  const layout = LAYOUT[lang];

  function append(ch: string) {
    if (value.length >= maxLength) return;
    onChange(value + ch);
  }
  function backspace() {
    onChange(value.slice(0, -1));
  }
  function clear() {
    onChange("");
  }
  function toggleLang() {
    setLang((l) => (l === "he" ? "en" : "he"));
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 bg-white border-t border-qf-line-soft shadow-[0_-12px_40px_rgba(17,35,26,0.12)] animate-qf-sheet-in",
        className,
      )}
    >
      <div className="max-w-4xl mx-auto px-5 py-5 space-y-2.5">
        <div className="flex items-center justify-between gap-3 pb-1">
          <div className="text-xs font-bold tracking-[0.18em] text-qf-mute uppercase">
            מקלדת
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleLang}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-bold text-qf-ink2 hover:bg-qf-line-soft transition"
              aria-label={lang === "he" ? "החלף לאנגלית" : "החלף לעברית"}
            >
              <Globe size={16} strokeWidth={2} aria-hidden />
              <span className="tnum">{lang === "he" ? "EN" : "עב"}</span>
            </button>
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

        {placeholder !== undefined && (
          <div
            dir="auto"
            className="min-h-12 px-4 py-2.5 rounded-xl bg-qf-line-soft/50 border border-qf-line-soft text-lg text-qf-ink leading-snug break-words"
          >
            {value || (
              <span className="text-qf-mute">{placeholder}</span>
            )}
            {value && value.length < maxLength && (
              <span
                className="inline-block w-[2px] h-[1.1em] align-middle bg-(--qf-primary) ms-1 animate-qf-pulse"
                aria-hidden
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-10 gap-2" dir="ltr">
          {layout.rows.flatMap((row, ri) =>
            row.map((k, ki) =>
              k === BS ? (
                <KeyButton
                  key={`${ri}-${ki}-bs`}
                  onPress={backspace}
                  ariaLabel="מחק"
                >
                  <BackspaceGlyph />
                </KeyButton>
              ) : (
                <KeyButton key={`${ri}-${ki}-${k}`} onPress={() => append(k)}>
                  {k}
                </KeyButton>
              ),
            ),
          )}
        </div>

        <div className="grid grid-cols-10 gap-2">
          <KeyButton
            className="col-span-8 text-lg font-semibold"
            onPress={() => append(" ")}
            ariaLabel="רווח"
          >
            רווח
          </KeyButton>
          <KeyButton
            className="col-span-2 text-lg"
            tone="primary"
            onPress={onClose}
            ariaLabel="סיים"
          >
            סיום
          </KeyButton>
        </div>
      </div>
    </div>
  );
}

function KeyButton({
  children,
  onPress,
  ariaLabel,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  onPress: () => void;
  ariaLabel?: string;
  className?: string;
  tone?: "default" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={ariaLabel}
      className={cn(
        "h-16 rounded-xl border text-2xl font-bold transition active:scale-[0.96] active:shadow-none shadow-[0_2px_0_rgba(17,35,26,0.08)] grid place-items-center uppercase",
        tone === "primary"
          ? "bg-(--qf-primary) text-white border-(--qf-deep) hover:bg-(--qf-deep)"
          : "bg-white text-qf-ink border-qf-line-soft hover:bg-qf-line-soft",
        className,
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
