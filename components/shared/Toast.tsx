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

  const palette =
    toast.kind === "ok"
      ? "bg-qf-green-deep text-white"
      : toast.kind === "err"
        ? "bg-qf-tomato text-white"
        : "bg-qf-ink text-white";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 inset-s-5 z-[100] pointer-events-none"
    >
      <div
        className={cn(
          "pointer-events-auto inline-flex items-center gap-2 rounded-xl shadow-lg px-4 py-2.5 text-sm",
          palette,
        )}
      >
        {toast.kind === "ok" && <IcoCheck c="currentColor" s={16} />}
        {toast.kind === "err" && <IcoClose c="currentColor" s={16} />}
        {toast.kind === "info" && <IcoWarning c="currentColor" s={16} />}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
