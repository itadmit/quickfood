/**
 * New-order chime library shared by the orders board (NewOrderChime) and the
 * kitchen display. Seven recorded chimes live in /public/sounds. The chosen
 * chime + on/off state live in localStorage (per device), not on the tenant.
 */

export type ChimeId = "1" | "2" | "3" | "4" | "5" | "6" | "7";

export const CHIME_OPTIONS: { id: ChimeId; label: string; file: string }[] = [
  { id: "1", label: "רגיל", file: "/sounds/new.mp3" },
  { id: "2", label: "פעמון דלת", file: "/sounds/new02.mp3" },
  { id: "3", label: "קאצ׳ינג", file: "/sounds/new03.mp3" },
  { id: "4", label: "מי זה", file: "/sounds/new04.mp3" },
  { id: "5", label: "טו-דו", file: "/sounds/new05.mp3" },
  { id: "6", label: "מי אני", file: "/sounds/new06.mp3" },
  { id: "7", label: "קסם", file: "/sounds/new07.mp3" },
];

const FILE_BY_ID = Object.fromEntries(
  CHIME_OPTIONS.map((o) => [o.id, o.file]),
) as Record<ChimeId, string>;

export const CHIME_ENABLED_KEY = "qf_merchant_chime_enabled";
export const CHIME_SOUND_KEY = "qf_merchant_chime_sound";

export function getSelectedChime(): ChimeId {
  if (typeof window === "undefined") return "1";
  const v = window.localStorage.getItem(CHIME_SOUND_KEY) as ChimeId | null;
  return v && FILE_BY_ID[v] ? v : "1";
}

// One <audio> per file, reused across plays.
const cache = new Map<string, HTMLAudioElement>();
function el(file: string): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  let a = cache.get(file);
  if (!a) {
    a = new Audio(file);
    a.preload = "auto";
    cache.set(file, a);
  }
  return a;
}

/**
 * Call on a user gesture so the selected chime can autoplay later
 * (iOS/Chrome block audio until the element has played once on a gesture).
 */
export function unlockChimeAudio() {
  const a = el(FILE_BY_ID[getSelectedChime()]);
  if (!a) return;
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    })
    .catch(() => {
      a.muted = false;
    });
}

export function playChime(id: ChimeId = getSelectedChime()) {
  const a = el(FILE_BY_ID[id] ?? FILE_BY_ID["1"]);
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * Continuous ringing until the order is accepted (Wolt-style). ON by default;
 * a device can opt out via CHIME_LOOP_KEY = "0" (the general mute also stops
 * it). While looping, the chime replays with a short gap until stopChimeLoop()
 * is called (the board stops it once no new order is waiting). A watchdog
 * interval also retries if the browser blocked a play() (autoplay policy).
 */
export const CHIME_LOOP_KEY = "qf_merchant_chime_loop";
// Pause between rings. ~1-2.5s sounds + 4s quiet = one ring every ~5-6.5s:
// hard to miss in a busy kitchen, without being a non-stop alarm.
const LOOP_GAP_MS = 4000;

export function getChimeLoopEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(CHIME_LOOP_KEY) !== "0";
}

let loopTimer: number | null = null;
let loopFile: string | null = null;
let lastEndedAt = 0;

export function startChimeLoop(id: ChimeId = getSelectedChime()) {
  const file = FILE_BY_ID[id] ?? FILE_BY_ID["1"];
  if (loopTimer != null && loopFile === file) return;
  stopChimeLoop();
  const a = el(file);
  if (!a) return;
  loopFile = file;
  a.onended = () => {
    lastEndedAt = Date.now();
  };
  let lastStartAt = 0;
  const tick = () => {
    if (!a.paused && !a.ended) return; // still playing
    const now = Date.now();
    if (now - lastEndedAt < LOOP_GAP_MS) return;
    // play() is pending (still loading) or was blocked - retry, but not faster
    // than every 3s so a slow load isn't restarted over and over.
    if (!a.ended && now - lastStartAt < 3000) return;
    lastStartAt = now;
    try {
      a.currentTime = 0;
      void a.play().catch(() => {});
    } catch {
      /* ignore */
    }
  };
  lastEndedAt = 0;
  tick();
  loopTimer = window.setInterval(tick, 500);
}

export function stopChimeLoop() {
  if (loopTimer != null) {
    window.clearInterval(loopTimer);
    loopTimer = null;
  }
  if (loopFile) {
    const a = cache.get(loopFile);
    if (a) {
      a.onended = null;
      a.pause();
      a.currentTime = 0;
    }
    loopFile = null;
  }
}
