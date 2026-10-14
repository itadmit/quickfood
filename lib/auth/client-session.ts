"use client";
/**
 * Browser side of the session: keep it rolling, and when it really is gone,
 * say so out loud.
 *
 * The access cookie is long-lived but still finite, and nothing used to renew
 * it - a merchant was signed out exactly N days after logging in, mid-shift,
 * with no warning. Worse, every poll on the orders board bailed on `!res.ok`,
 * so an expired session looked identical to a quiet evening: the board sat
 * there showing the last snapshot it ever managed to fetch and the chime never
 * rang again.
 *
 * So two things live here:
 *   • `touchSession` rolls both cookies in the background (at most once every
 *     12h) so an active store never reaches the expiry at all.
 *   • `fetchWithSession` turns a 401 into one refresh-and-retry, and if that
 *     fails, fires SESSION_EXPIRED_EVENT so the UI can block the screen
 *     instead of pretending nothing happened.
 */

export const SESSION_EXPIRED_EVENT = "qf:session-expired";

const REFRESHED_AT_KEY = "qf_session_refreshed_at";
const MIN_REFRESH_GAP_MS = 12 * 60 * 60 * 1000;

// One refresh at a time: the board, the kitchen display and the realtime
// socket can all hit a 401 in the same tick, and three concurrent rotations
// would have two of them writing cookies derived from a token the third
// already replaced.
let inFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_type: "web" }),
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return false;
      try {
        localStorage.setItem(REFRESHED_AT_KEY, String(Date.now()));
      } catch {
        /* private mode - the refresh still worked, we just can't remember it */
      }
      return true;
    } catch {
      return false;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function touchSession(): Promise<void> {
  let last = 0;
  try {
    last = Number(localStorage.getItem(REFRESHED_AT_KEY)) || 0;
  } catch {
    /* no storage - fall through and refresh */
  }
  if (last && Date.now() - last < MIN_REFRESH_GAP_MS) return;
  await refreshSession();
}

export function announceSessionExpired(): void {
  try {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  } catch {
    /* ignore */
  }
}

export async function fetchWithSession(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, { credentials: "include", ...init });
  if (res.status !== 401) return res;

  if (!(await refreshSession())) {
    announceSessionExpired();
    return res;
  }
  const retried = await fetch(input, { credentials: "include", ...init });
  if (retried.status === 401) announceSessionExpired();
  return retried;
}
