"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IcoClose } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

type Size = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";

const SIZE_CLASS: Record<Size, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
  "5xl": "sm:max-w-5xl",
};

/**
 * Mobile-safe modal shell.
 *
 * Mobile: docks to the bottom of the viewport as a sheet, rounded-top, the
 * panel itself is capped at 95dvh so the sticky header (and its close
 * button) always stay inside the visible frame.
 *
 * Desktop (sm+): centered card, max-w controlled via `size`, capped at
 * 90vh with the same internal scroll structure.
 *
 * Compose with <ModalHeader/>, <ModalBody/>, <ModalFooter/> so the close
 * button is sticky at the top and the body scrolls independently - that
 * is the whole point of this shell, do not skip the wrappers.
 */
export function Modal({
  open,
  onClose,
  size = "md",
  ariaLabel,
  closeOnBackdrop = true,
  className,
  panelStyle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  size?: Size;
  ariaLabel?: string;
  closeOnBackdrop?: boolean;
  className?: string;
  panelStyle?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/50 backdrop-blur-sm sm:p-4 md:p-6"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "relative w-full flex flex-col bg-white shadow-2xl",
          "rounded-t-3xl sm:rounded-3xl",
          "max-h-[95dvh] sm:max-h-[90vh]",
          "animate-qf-sheet-in sm:animate-qf-modal-in",
          SIZE_CLASS[size],
          className,
        )}
        style={panelStyle}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Sticky modal header. Renders title + close button by default, or
 * arbitrary children if you need a custom layout. Always sits inside the
 * panel so the X is reachable regardless of body scroll position.
 */
export function ModalHeader({
  title,
  subtitle,
  onClose,
  children,
  className,
  tone = "white",
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
  tone?: "white" | "transparent";
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-10 px-4 sm:px-6 py-3.5 flex items-center gap-3",
        tone === "white"
          ? "bg-white border-b border-qf-line-soft"
          : "bg-transparent",
        className,
      )}
    >
      {children ?? (
        <div className="flex-1 min-w-0">
          {title && (
            <h2 className="text-base font-bold text-qf-ink truncate">{title}</h2>
          )}
          {subtitle && (
            <p className="text-xs text-qf-mute mt-0.5">{subtitle}</p>
          )}
        </div>
      )}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור"
          className="shrink-0 w-9 h-9 rounded-full hover:bg-qf-line-soft grid place-items-center text-qf-mute"
        >
          <IcoClose s={18} />
        </button>
      )}
    </div>
  );
}

export function ModalBody({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 min-h-0 overflow-y-auto",
        padded && "px-4 sm:px-6 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 border-t border-qf-line-soft bg-white",
        "px-4 sm:px-6 py-3 flex items-center justify-end gap-2",
        "rounded-b-none sm:rounded-b-3xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
