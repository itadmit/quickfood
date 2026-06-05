"use client";

import { cn } from "@/lib/cn";

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * Standard QuickFood toggle - black-bordered pill with primary-color
 * fill when on, solid black when off, and a centered white indicator
 * that slides between corners. RTL-aware (uses inset-inline-*).
 */
export function Toggle({
  checked,
  onChange,
  disabled,
  className,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-black transition disabled:opacity-50 disabled:cursor-not-allowed",
        checked ? "bg-(--qf-primary)" : "bg-black",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 -translate-y-1/2 inline-block h-4 w-4 rounded-full bg-white transition",
          checked ? "inset-e-0.5" : "inset-s-0.5",
        )}
      />
    </button>
  );
}
