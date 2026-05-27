"use client";

import { useState } from "react";

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
  suggestions: string[];
  error: string | null;
}

export function AIComposer({ disabled, onSend, suggestions, error }: Props) {
  const [value, setValue] = useState("");

  function submit() {
    const t = value.trim();
    if (!t || disabled) return;
    setValue("");
    onSend(t);
  }

  return (
    <div className="border-t border-qf-line-soft bg-white px-3 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="max-w-md mx-auto space-y-2">
        {error && (
          <div className="text-xs text-qf-tomato bg-qf-tomato-soft border border-qf-tomato/30 rounded-xl px-3 py-1.5">
            {error}
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => onSend(s)}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-qf-line-soft hover:bg-black hover:text-white transition disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="ספר לי מה בא לך…"
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none max-h-32 px-4 py-2.5 rounded-2xl border border-qf-line-dash focus:border-black outline-none text-sm leading-relaxed bg-qf-bg"
          />
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            aria-label="שלח"
            className="w-10 h-10 shrink-0 rounded-full bg-black text-white flex items-center justify-center disabled:opacity-40 hover:bg-black/85 transition"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12l16-8-4 8 4 8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="currentColor"
      />
    </svg>
  );
}
