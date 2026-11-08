"use client";

import { useEffect, useRef, useState } from "react";
import { IcoBell } from "@/components/shared/Icons";
import {
  CHIME_ENABLED_KEY,
  CHIME_SOUND_KEY,
  CHIME_OPTIONS,
  CHIME_LOOP_KEY,
  getChimeLoopEnabled,
  getSelectedChime,
  startChimeLoop,
  stopChimeLoop,
  playChime,
  unlockChimeAudio,
  type ChimeId,
} from "@/lib/order-chime";

/**
 * `waiting` = at least one order is still waiting to be accepted. While true
 * the chime rings continuously (Wolt-style) unless this device muted sound or
 * switched continuous ringing off in the picker.
 */
export function NewOrderChime({ waiting = false }: { waiting?: boolean } = {}) {
  const [muted, setMuted] = useState(false);
  const [sound, setSound] = useState<ChimeId>("1");
  const [loop, setLoop] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMuted(localStorage.getItem(CHIME_ENABLED_KEY) === "0");
    setSound(getSelectedChime());
    setLoop(getChimeLoopEnabled());
  }, []);

  // Continuous ringing until the order is accepted (on by default).
  useEffect(() => {
    if (loop && waiting && !muted) startChimeLoop(sound);
    else stopChimeLoop();
  }, [loop, waiting, muted, sound]);
  useEffect(() => () => stopChimeLoop(), []);

  // Unlock audio on the first user gesture so chimes can autoplay later.
  useEffect(() => {
    function unlock() {
      unlockChimeAudio();
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    }
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    function handler() {
      if (muted) return;
      playChime(sound);
    }
    window.addEventListener("qf:new-order", handler);
    return () => window.removeEventListener("qf:new-order", handler);
  }, [muted, sound]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen]);

  const enabled = !muted;

  function toggle() {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(CHIME_ENABLED_KEY, next ? "0" : "1");
  }

  function toggleLoop() {
    const next = !loop;
    setLoop(next);
    localStorage.setItem(CHIME_LOOP_KEY, next ? "1" : "0");
  }

  function pick(id: ChimeId) {
    setSound(id);
    localStorage.setItem(CHIME_SOUND_KEY, id);
    // The click is a user gesture, so playing here both previews the sound
    // and unlocks this element for autoplay. Do NOT call unlockChimeAudio()
    // here - its muted play+pause races with (and silences) this preview.
    playChime(id);
  }

  return (
    <div ref={wrapRef} className="hidden sm:inline-flex items-center relative">
      <button
        type="button"
        onClick={toggle}
        title={enabled ? "סאונד פעיל - לחץ להשתקה" : "סאונד מושתק - לחץ להפעלה"}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-s-lg text-xs font-medium border ${
          enabled
            ? "border-qf-green-deep bg-qf-green-soft text-qf-green-deep"
            : "border-qf-line-dash text-qf-mute hover:bg-qf-line-soft"
        }`}
      >
        <IcoBell c={enabled ? "var(--qf-deep)" : "#7c8a82"} s={14} />
        <span>{enabled ? "סאונד פעיל" : "סאונד מושתק"}</span>
      </button>
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        title="החלפת צליל"
        className="inline-flex items-center px-2.5 py-1.5 rounded-e-lg border border-s-0 border-qf-line-dash text-xs font-medium text-qf-ink2 hover:bg-qf-line-soft"
      >
        החלפת צליל
      </button>
      {pickerOpen && (
        <div className="absolute top-full inset-e-0 mt-1.5 w-44 bg-white border border-qf-line-dash rounded-xl shadow-lg p-1 z-50">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-qf-mute">
            צליל התראה
          </div>
          {CHIME_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => pick(o.id)}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm hover:bg-qf-line-soft ${
                o.id === sound ? "font-semibold text-qf-ink" : "text-qf-ink2"
              }`}
            >
              <span>{o.label}</span>
              {o.id === sound && (
                <span className="text-qf-green-deep text-xs">●</span>
              )}
            </button>
          ))}
          <div className="px-2.5 pt-1.5 pb-1 text-[10px] text-qf-mute leading-snug">
            לחיצה על צליל גם משמיעה אותו לדוגמה
          </div>
          <label className="flex items-start gap-2 px-2.5 py-2 mt-1 border-t border-qf-line-dash text-xs text-qf-ink2 cursor-pointer">
            <input
              type="checkbox"
              checked={loop}
              onChange={toggleLoop}
              className="mt-0.5 w-3.5 h-3.5 accent-(--qf-primary)"
            />
            <span>
              צלצול רציף עד אישור ההזמנה
              <span className="block text-[10px] text-qf-mute leading-snug">
                הצליל חוזר כל עוד יש הזמנה שממתינה לאישור. נשמר במכשיר הזה.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
