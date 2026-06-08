import { FB_PIXEL_ID } from "./config";

type Params = Record<string, unknown>;
type UserData = { email?: string; phone?: string };

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function eventId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sendCapi(
  eventName: string,
  params: Params,
  id: string,
  user?: UserData,
) {
  try {
    void fetch("/api/fb-capi", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventName,
        params,
        eventId: id,
        eventSourceUrl: typeof location !== "undefined" ? location.href : undefined,
        user,
      }),
      keepalive: true,
    });
  } catch {
    /* fire and forget */
  }
}

export function track(eventName: string, params: Params = {}, user?: UserData) {
  if (!FB_PIXEL_ID) return;
  const id = eventId();
  window.fbq?.("track", eventName, params, { eventID: id });
  sendCapi(eventName, params, id, user);
}

export function trackCustom(eventName: string, params: Params = {}, user?: UserData) {
  if (!FB_PIXEL_ID) return;
  const id = eventId();
  window.fbq?.("trackCustom", eventName, params, { eventID: id });
  sendCapi(eventName, params, id, user);
}

export function pageview() {
  if (!FB_PIXEL_ID) return;
  let tries = 0;
  const fire = () => {
    if (window.fbq) {
      window.fbq("track", "PageView");
      return;
    }
    if (tries++ < 20) setTimeout(fire, 100);
  };
  fire();
}
