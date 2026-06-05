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
 * Standard QuickFood toggle - black-bordered pill with brand-yellow
 * fill when on, solid black when off, and a centered white indicator
 * that slides between corners. RTL-aware (uses inset-inline-*).
 *
 * Yellow is hard-coded (not --qf-primary) because every consumer of
 * Toggle is merchant-facing (dashboard / admin) where the brand color
 * is always #F8CB1E, regardless of the tenant's customer-storefront
 * theme. Inheriting --qf-primary would make the dashboard toggles
 * change color per tenant, which is wrong.
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
        checked ? "bg-[#F8CB1E]" : "bg-black",
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
