"use client";

import { IcoCheck, IcoClose } from "@/components/shared/Icons";

export function SettingsSaveBar({
  saving,
  onSave,
  toast,
  disabled,
}: {
  saving: boolean;
  onSave: () => void;
  toast?: { kind: "ok" | "err"; msg: string } | null;
  disabled?: boolean;
}) {
  const label = saving ? "שומר..." : "שמירת שינויים";

  return (
    <div className="sticky bottom-3 z-10">
      {/* Mobile: full-width yellow button, no white box */}
      <div className="sm:hidden px-3 space-y-1.5">
        {toast && (
          <div
            className={
              "text-center text-xs font-bold " +
              (toast.kind === "ok" ? "text-qf-green-deep" : "text-qf-tomato")
            }
          >
            {toast.msg}
          </div>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || disabled}
          className="w-full py-4 rounded-2xl bg-[#F8CB1E] hover:bg-[#FFD843] text-black border-2 border-black shadow-[0_3px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] text-base font-black transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {label}
        </button>
      </div>

      {/* Desktop: full-width white bar */}
      <div className="hidden sm:flex items-center justify-between gap-3 bg-white rounded-2xl border-2 border-black px-4 py-3 shadow-[0_3px_0_#000] mx-3 lg:mx-4">
        <div className="text-sm">
          {toast && (
            <span
              className={
                "inline-flex items-center gap-1.5 font-bold " +
                (toast.kind === "ok" ? "text-qf-green-deep" : "text-qf-tomato")
              }
            >
              {toast.kind === "ok" ? (
                <IcoCheck c="currentColor" s={14} />
              ) : (
                <IcoClose c="currentColor" s={14} />
              )}
              {toast.msg}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || disabled}
          className="px-5 py-2.5 rounded-xl bg-[#F8CB1E] hover:bg-[#FFD843] text-black border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {label}
        </button>
      </div>
    </div>
  );
}
