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
          {label && <label className="text-sm font-black text-black">{label}</label>}
          {hint && <span className="text-xs font-medium text-black/55">{hint}</span>}
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "w-full flex items-center gap-3 border-2 border-black rounded-xl px-2.5 py-2 transition",
            open
              ? "bg-white shadow-[0_3px_0_#000]"
              : "bg-[#FFFBEC] hover:bg-white",
          )}
        >
          <MenuItemImage
            alt={selected.label}
            businessType={selected.value}
            size={48}
            rounded="lg"
          />
          <span className="flex-1 text-start font-bold text-black">{selected.label}</span>
          <ChevronDown
            size={18}
            className={cn(
              "text-black/55 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open && (
          <ul
            role="listbox"
            className="absolute z-30 inset-x-0 mt-2 bg-white border-2 border-black rounded-xl shadow-[0_4px_0_#000] overflow-hidden max-h-105 overflow-y-auto"
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
                        ? "bg-[#FFF6CE]"
                        : "hover:bg-black/5",
                    )}
                  >
                    <MenuItemImage
                      alt={t.label}
                      businessType={t.value}
                      size={44}
                      rounded="lg"
                    />
                    <span className="flex-1 font-bold text-sm text-black">{t.label}</span>
                    {active && (
                      <Check
                        size={16}
                        className="text-black shrink-0"
                        strokeWidth={2.8}
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
