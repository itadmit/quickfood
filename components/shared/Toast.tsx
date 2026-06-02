"use client";

import { useEffect } from "react";
import { IcoCheck, IcoClose, IcoWarning } from "@/components/shared/Icons";
import { cn } from "@/lib/cn";

export type ToastKind = "ok" | "err" | "info";

export interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

interface Props {
  toast: ToastState | null;
  onDismiss: () => void;
  /** ms before auto-dismiss. Default 2500. */
  duration?: number;
}

/**
 * Fixed-position toast at the bottom-left of the viewport. Single-message
 * (latest replaces previous). Auto-dismisses after `duration` ms.
 *
 * Pair with a useState<ToastState | null> in the parent and a tiny helper:
 *
 *   const [toast, setToast] = useState<ToastState | null>(null);
 *   const push = (kind: ToastKind, message: string) =>
 *     setToast({ id: Date.now(), kind, message });
 *
 * Then `<Toast toast={toast} onDismiss={() => setToast(null)} />`.
 */
export function Toast({ toast, onDismiss, duration = 2500 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [toast, onDismiss, duration]);

  if (!toast) return null;

  // Chunky "card-style" toast matching the v2 dashboard's offset-shadow
  // + thick black border language. The status colour lives in the icon
  // chip so the surface stays neutral (white) and the message reads
  // strongly against either cream or white surrounding surfaces.
  const chip =
    toast.kind === "ok"
      ? "bg-qf-green-soft text-qf-green-deep border-qf-green-deep"
      : toast.kind === "err"
        ? "bg-qf-tomato-soft text-qf-tomato border-qf-tomato"
        : "bg-qf-yolk-soft text-qf-ink border-qf-ink";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 inset-s-6 z-[100] pointer-events-none animate-qf-toast-in"
    >
      <div className="pointer-events-auto inline-flex items-center gap-3 bg-white text-qf-ink rounded-2xl border-2 border-qf-ink px-4 py-3 shadow-[0_4px_0_rgba(17,35,26,0.95)]">
        <span
          className={cn(
            "inline-grid place-items-center w-8 h-8 rounded-full border-2 shrink-0",
            chip,
          )}
        >
          {toast.kind === "ok" && <IcoCheck c="currentColor" s={16} />}
          {toast.kind === "err" && <IcoClose c="currentColor" s={16} />}
          {toast.kind === "info" && <IcoWarning c="currentColor" s={16} />}
        </span>
        <span className="text-base font-bold pe-1">{toast.message}</span>
      </div>
    </div>
  );
}
