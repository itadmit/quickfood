"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { formatCountdown, usePauseCountdown } from "@/components/shared/usePauseCountdown";
import {
  PAUSE_CUSTOM_MAX_MINUTES,
  PAUSE_CUSTOM_MIN_MINUTES,
  PAUSE_PRESET_MINUTES,
} from "@/lib/branch-hours";

export function PauseOrdersControl({
  branchId,
  pausedUntil,
  onDone,
  variant = "v1",
}: {
  branchId: string;
  pausedUntil: string | null;
  onDone: () => void;
  variant?: "v1" | "v2";
}) {
  const router = useRouter();
  const left = usePauseCountdown(pausedUntil);
  const paused = left !== null && left > 0;
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(pauseMinutes: number | null) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/merchant/branches/${branchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pause_minutes: pauseMinutes }),
      });
      if (!res.ok) {
        setError("העדכון נכשל, נסו שוב");
        return;
      }
      setCustom("");
      router.refresh();
      onDone();
    } catch {
      setError("העדכון נכשל, נסו שוב");
    } finally {
      setSaving(false);
    }
  }

  const customMinutes = Math.round(Number(custom));
  const customValid =
    custom.trim() !== "" &&
    Number.isFinite(customMinutes) &&
    customMinutes >= PAUSE_CUSTOM_MIN_MINUTES &&
    customMinutes <= PAUSE_CUSTOM_MAX_MINUTES;

  const v2 = variant === "v2";

  return (
    <div
      className={cn("px-2 pt-2 pb-1 mt-1 border-t", v2 ? "border-black/10" : "border-qf-line-soft")}
      data-pause-control
    >
      {paused ? (
        <div className="px-1 pb-2">
          <div className={cn("text-sm font-bold", v2 ? "text-black" : "text-qf-tomato")}>
            קבלת הזמנות מושהית
          </div>
          <div className={cn("text-xs mt-0.5", v2 ? "text-black/60" : "text-qf-mute")}>
            עד {formatTime(pausedUntil!)} · נשארו{" "}
            <span className="tnum" dir="ltr" suppressHydrationWarning>
              {formatCountdown(left!)}
            </span>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => send(null)}
            className={cn(
              "mt-2 w-full h-9 rounded-lg text-sm font-bold transition disabled:opacity-60",
              v2
                ? "bg-[#F8CB1E] text-black border-2 border-black"
                : "bg-qf-green text-white hover:opacity-90",
            )}
          >
            פתח עכשיו
          </button>
        </div>
      ) : null}

      <div className={cn("px-1 text-xs font-bold", v2 ? "text-black/70" : "text-qf-ink2")}>
        {paused ? "שינוי משך ההשהיה" : "השהיית הזמנות זמנית"}
      </div>
      {!paused && (
        <div className={cn("px-1 text-[11px] mt-0.5", v2 ? "text-black/50" : "text-qf-mute")}>
          הלקוחות יראו ספירה לאחור, והחנות תיפתח אוטומטית בסוף הזמן
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5 mt-2">
        {PAUSE_PRESET_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            disabled={saving}
            onClick={() => send(m)}
            className={cn(
              "h-9 rounded-lg text-sm font-bold tnum transition whitespace-nowrap disabled:opacity-60",
              v2
                ? "border-2 border-black bg-white hover:bg-black/5"
                : "border border-qf-line-dash hover:bg-qf-line-soft",
            )}
          >
            {m} <span className="text-[11px] font-medium">דק׳</span>
          </button>
        ))}
      </div>
      <form
        className="flex gap-1.5 mt-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (customValid) void send(customMinutes);
        }}
      >
        <input
          type="number"
          inputMode="numeric"
          min={PAUSE_CUSTOM_MIN_MINUTES}
          max={PAUSE_CUSTOM_MAX_MINUTES}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="דקות אחר"
          aria-label="משך השהיה בדקות"
          className={cn(
            "flex-1 min-w-0 h-9 rounded-lg px-2 text-sm tnum",
            v2 ? "border-2 border-black" : "border border-qf-line-dash",
          )}
        />
        <button
          type="submit"
          disabled={saving || !customValid}
          className={cn(
            "h-9 px-3 rounded-lg text-sm font-bold transition disabled:opacity-40",
            v2 ? "bg-black text-white" : "bg-qf-ink text-white",
          )}
        >
          השהה
        </button>
      </form>
      {error && <div className="px-1 mt-1 text-xs text-qf-tomato">{error}</div>}
    </div>
  );
}
