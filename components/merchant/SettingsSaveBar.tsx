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
  const isSaved = !saving && toast?.kind === "ok";
  const isError = !saving && toast?.kind === "err";

  return (
    <>
      {/* Mobile: sticky white bar, -mx-3 bleeds past main's p-3 padding to full viewport width */}
      <div className="sm:hidden sticky bottom-0 z-10 bg-white border-t-2 border-black px-4 pt-3 pb-4 -mx-3">
        {isError && (
          <p className="text-center text-xs font-bold text-qf-tomato mb-2">
            {toast!.msg}
          </p>
        )}
        <button
          type="button"
          onClick={saving || disabled ? undefined : onSave}
          className={
            "w-full py-4 rounded-2xl border-2 text-base font-black transition-all duration-200 " +
            (saving
              ? "bg-[#F8CB1E]/60 text-black/60 border-black/40 shadow-none"
              : isSaved
              ? "bg-qf-green-soft text-qf-green-deep border-qf-green-deep/30 shadow-none"
              : "bg-[#F8CB1E] text-black border-black shadow-[0_3px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000]")
          }
        >
          {saving ? "שומר..." : isSaved ? "נשמר" : "שמירת שינויים"}
        </button>
      </div>

      {/* Desktop: inline row at bottom of form, not sticky */}
      <div className="hidden sm:flex items-center justify-between gap-3">
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
          {saving ? "שומר..." : "שמירת שינויים"}
        </button>
      </div>
    </>
  );
}
