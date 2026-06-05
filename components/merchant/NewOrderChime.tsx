"use client";

import { useEffect, useRef, useState } from "react";
import { IcoBell } from "@/components/shared/Icons";

const STORAGE_KEY = "qf_merchant_chime_enabled";

export function NewOrderChime() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(STORAGE_KEY);
    setMuted(saved === "0");

    const el = new Audio("/sounds/new.mp3");
    el.preload = "auto";
    el.onerror = () => {
      const wav = new Audio("/sounds/new.wav");
      wav.preload = "auto";
      audioRef.current = wav;
    };
    audioRef.current = el;
  }, []);

  useEffect(() => {
    if (muted) return;
    function unlock() {
      const el = audioRef.current;
      if (!el) return;
      el.muted = true;
      el.play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
          setUnlocked(true);
        })
        .catch(() => {
          /* user hasn't interacted yet */
        });
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    }
    window.addEventListener("click", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("click", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [muted]);

  useEffect(() => {
    function handler() {
      if (muted) return;
      const el = audioRef.current;
      if (!el) return;
      try {
        el.currentTime = 0;
        void el.play();
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("qf:new-order", handler);
    return () => window.removeEventListener("qf:new-order", handler);
  }, [muted]);

  useEffect(() => {
    setEnabled(unlocked && !muted);
  }, [unlocked, muted]);

  function toggle() {
    const next = muted; // currently muted = true; flipping = unmuting
    setMuted(!next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={enabled ? "סאונד פעיל - לחץ להשתקה" : "סאונד מושתק - לחץ להפעלה"}
      className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
        enabled
          ? "border-qf-green-deep bg-qf-green-soft text-qf-green-deep"
          : "border-qf-line-dash text-qf-mute hover:bg-qf-line-soft"
      }`}
    >
      <IcoBell c={enabled ? "var(--qf-deep)" : "#7c8a82"} s={14} />
      <span>{enabled ? "סאונד פעיל" : "סאונד מושתק"}</span>
    </button>
  );
}
