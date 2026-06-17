/**
 * New-order chime library shared by the orders board (NewOrderChime) and the
 * kitchen display. "classic" plays the recorded /sounds/new.mp3 (the original
 * default); the rest are synthesized with the Web Audio API so we ship no
 * extra audio assets and they always play. The chosen chime + on/off state
 * live in localStorage (per device), not on the tenant.
 */

export type ChimeId = "classic" | "ding" | "bell" | "triple" | "marimba";

export const CHIME_OPTIONS: { id: ChimeId; label: string }[] = [
  { id: "classic", label: "קלאסי" },
  { id: "ding", label: "דינג" },
  { id: "bell", label: "פעמון" },
  { id: "triple", label: "שלושער" },
  { id: "marimba", label: "מרימבה" },
];

export const CHIME_ENABLED_KEY = "qf_merchant_chime_enabled";
export const CHIME_SOUND_KEY = "qf_merchant_chime_sound";

export function getSelectedChime(): ChimeId {
  if (typeof window === "undefined") return "classic";
  const v = window.localStorage.getItem(CHIME_SOUND_KEY) as ChimeId | null;
  return v && CHIME_OPTIONS.some((o) => o.id === v) ? v : "classic";
}

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
}

/** Call on a user gesture so synthesized chimes can play later (autoplay). */
export function unlockChimeAudio() {
  const c = ctx();
  if (c && c.state === "suspended") void c.resume();
}

function blip(
  c: AudioContext,
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType = "sine",
  peak = 0.18,
) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = c.currentTime + at;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function playSynth(id: Exclude<ChimeId, "classic">) {
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  switch (id) {
    case "ding":
      blip(c, 880, 0, 0.25, "sine", 0.22);
      blip(c, 1320, 0.07, 0.3, "sine", 0.15);
      break;
    case "bell":
      blip(c, 660, 0, 0.55, "triangle", 0.22);
      blip(c, 990, 0, 0.55, "sine", 0.1);
      break;
    case "triple":
      blip(c, 784, 0, 0.12, "square", 0.12);
      blip(c, 784, 0.18, 0.12, "square", 0.12);
      blip(c, 1047, 0.36, 0.2, "square", 0.14);
      break;
    case "marimba":
      blip(c, 523, 0, 0.18, "sine", 0.22);
      blip(c, 659, 0.12, 0.18, "sine", 0.22);
      blip(c, 784, 0.24, 0.28, "sine", 0.22);
      break;
  }
}

let classicEl: HTMLAudioElement | null = null;
function classicAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!classicEl) {
    const el = new Audio("/sounds/new.mp3");
    el.preload = "auto";
    el.onerror = () => {
      classicEl = new Audio("/sounds/new.wav");
      classicEl.preload = "auto";
    };
    classicEl = el;
  }
  return classicEl;
}

export function playChime(id: ChimeId = getSelectedChime()) {
  if (id === "classic") {
    const el = classicAudio();
    if (!el) return;
    try {
      el.currentTime = 0;
      void el.play().catch(() => {});
    } catch {
      /* ignore */
    }
    return;
  }
  playSynth(id);
}
