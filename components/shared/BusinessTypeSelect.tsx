"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import {
  BUSINESS_TYPES,
  type BusinessType,
  MenuItemImage,
} from "@/components/shared/MenuItemImage";
import { cn } from "@/lib/cn";

interface Props {
  value: BusinessType;
  onChange: (next: BusinessType) => void;
  /** Optional explicit label rendered above the control */
  label?: string;
  /** Optional hint text on the same line as the label */
  hint?: string;
  className?: string;
}

/**
 * Select2-style dropdown for picking a tenant's business type.
 * Shows a tile preview for the selected type in the trigger, opens
 * a scrollable panel with all options on click.
 */
export function BusinessTypeSelect({
  value,
  onChange,
  label,
  hint,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = BUSINESS_TYPES.find((t) => t.value === value) ?? BUSINESS_TYPES[0];

  // close on outside-click / Escape
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={cn("space-y-1.5", className)} ref={wrapRef}>
      {(label || hint) && (
        <div className="flex items-baseline justify-between">
          {label && <label className="text-sm font-medium">{label}</label>}
          {hint && <span className="text-xs text-qf-mute">{hint}</span>}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "w-full flex items-center gap-3 bg-white border rounded-xl px-2.5 py-2 transition",
            open
              ? "border-qf-ink ring-2 ring-qf-ink/10"
              : "border-qf-line-dash hover:border-qf-ink/40",
          )}
        >
          <MenuItemImage
            alt={selected.label}
            businessType={selected.value}
            size={48}
            rounded="lg"
          />
          <span className="flex-1 text-start font-medium">{selected.label}</span>
          <ChevronDown
            size={18}
            className={cn(
              "text-qf-mute transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute z-30 inset-x-0 mt-2 bg-white border border-qf-line-dash rounded-xl shadow-xl overflow-hidden max-h-[420px] overflow-y-auto"
          >
            {BUSINESS_TYPES.map((t) => {
              const active = t.value === value;
              return (
                <li key={t.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(t.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-2.5 py-2 text-start transition",
                      active
                        ? "bg-qf-green-soft/50"
                        : "hover:bg-qf-line-soft",
                    )}
                  >
                    <MenuItemImage
                      alt={t.label}
                      businessType={t.value}
                      size={44}
                      rounded="lg"
                    />
                    <span className="flex-1 font-medium text-sm">{t.label}</span>
                    {active && (
                      <Check
                        size={16}
                        className="text-qf-green-deep shrink-0"
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
