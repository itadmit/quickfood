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
