"use client";

import { useEffect } from "react";
import { IcoTrash } from "@/components/shared/Icons";
import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/cn";

type Variant = "danger" | "default";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "אישור",
  cancelLabel = "ביטול",
  variant = "default",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !busy) onConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onConfirm]);

  const danger = variant === "danger";

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onCancel();
      }}
      size="sm"
      closeOnBackdrop={!busy}
      ariaLabel={title}
    >
      <div className="flex items-start gap-3 p-5">
        <div
          className={cn(
            "w-11 h-11 rounded-full grid place-items-center shrink-0",
            danger ? "bg-qf-tomato-soft" : "bg-qf-green-soft",
          )}
        >
          {danger ? <IcoTrash s={20} c="#c2421f" /> : null}
        </div>
        <div className="flex-1 min-w-0">
          <h2 id="confirm-title" className="text-base font-semibold">
            {title}
          </h2>
          <div className="text-sm text-qf-ink2 mt-1 leading-relaxed">{message}</div>
        </div>
      </div>
      <div className="px-5 pb-5 pt-1 flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-4 py-2 rounded-xl border border-qf-line-dash hover:bg-qf-line-soft text-sm disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            "px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-60",
            danger
              ? "bg-qf-tomato hover:bg-[#a8381b]"
              : "bg-(--qf-primary) hover:bg-(--qf-deep)",
          )}
          autoFocus
        >
          {busy ? "..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
