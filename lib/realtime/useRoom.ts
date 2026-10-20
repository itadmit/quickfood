"use client";
/**
 * useRoom — subscribe a screen to a realtime room.
 *
 * Replaces the hand-rolled EventSource wiring that lived in both the orders
 * board and the customer tracking screen. Each had its own backoff, its own
 * visibilitychange handling, and its own subtly different idea of when to
 * refetch — the board's, notably, never closed the stream when the tab went
 * to the background, so a forgotten tab held a server function open around
 * the clock.
 *
 * The rules that matter here:
 *
 *   • the socket is closed when the tab is hidden. It costs nothing to
 *     reopen and the old code's failure to do this was a standing bill.
 *     `keepOpenWhenHidden` opts a screen out - a till that auto-prints is
 *     meant to work precisely while nobody is looking at it.
 *   • every reconnect calls `onResync` before anything else, because events
 *     that happened while disconnected are simply not replayed — the socket
 *     is a nudge, never the source of truth.
 *   • backoff caps at 30s so an outage settles into a slow retry rather than
 *     a tight loop across every open till in the country.
 */
import { useEffect, useRef } from "react";

import { fetchWithSession } from "@/lib/auth/client-session";

type Frame = { event?: string; data?: Record<string, unknown> };

export interface UseRoomArgs {
  /** Body for POST /api/v1/realtime/token. */
  scope: { scope: "merchant" } | { scope: "order"; orderId: string };
  /** Called for every frame. Keep it stable (useCallback) or it reconnects. */
  onEvent: (event: string, data: Record<string, unknown>) => void;
  /** Called on connect, on reconnect, and when the tab returns to the front. */
  onResync?: () => void;
  enabled?: boolean;
  /** Connection state, for screens that show the merchant whether they are live. */
  onStatus?: (connected: boolean) => void;
  /**
   * Hold the socket open while the screen is hidden.
   *
   * Off by default - a forgotten browser tab holding a socket open is the
   * cost this hook set out to remove. A till is the exception: it is a single
   * device per store whose whole job is to print an order the moment it
   * lands, and the merchant presses Home the second they start making food.
   * Closing the socket there means the order is only noticed when someone
   * walks back to the screen, which is the one thing auto-print exists to
   * avoid.
   */
  keepOpenWhenHidden?: boolean;
}

export function useRoom({
  scope,
  onEvent,
  onResync,
  enabled = true,
  onStatus,
  keepOpenWhenHidden = false,
}: UseRoomArgs) {
  // Held in refs so a caller passing inline functions does not tear the
  // socket down and rebuild it on every render. Synced in an effect rather
  // than during render: React may render without committing, and writing a
  // ref on a render that is then thrown away leaves the socket calling a
  // handler that was never actually mounted.
  const onEventRef = useRef(onEvent);
  const onResyncRef = useRef(onResync);
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onEventRef.current = onEvent;
    onResyncRef.current = onResync;
    onStatusRef.current = onStatus;
  });

  const key = JSON.stringify(scope);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let backoff = 1000;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const awake = () => keepOpenWhenHidden || document.visibilityState === "visible";

    const retry = () => {
      if (cancelled || !awake()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30_000);
    };

    async function connect() {
      if (cancelled || !awake()) return;
      let cfg: { enabled?: boolean; url?: string; room?: string; token?: string } | null;
      try {
        // The merchant scope 401s on an expired session, and the retry loop
        // below would otherwise hide that behind a polite 30s backoff
        // forever. fetchWithSession rolls the session once, then escalates to
        // SESSION_EXPIRED_EVENT so the merchant is actually told.
        const res = await fetchWithSession("/api/v1/realtime/token", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: key,
        });
        cfg = res.ok ? await res.json() : null;
      } catch {
        cfg = null;
      }
      if (cancelled) return;
      if (!cfg?.enabled || !cfg.url || !cfg.room || !cfg.token) {
        retry();
        return;
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(
          `${cfg.url.replace(/^http/, "ws")}/connect?room=${encodeURIComponent(cfg.room)}&token=${encodeURIComponent(cfg.token)}`,
        );
      } catch {
        retry();
        return;
      }
      socket = ws;

      ws.onopen = () => {
        backoff = 1000;
        onStatusRef.current?.(true);
        // Anything that happened while we were away is not replayed, so the
        // first thing a fresh connection does is re-read the truth.
        onResyncRef.current?.();
      };
      ws.onmessage = (e) => {
        if (e.data === "pong") return;
        try {
          const frame = JSON.parse(String(e.data)) as Frame;
          if (frame.event) onEventRef.current(frame.event, frame.data ?? {});
        } catch {
          /* malformed frame */
        }
      };
      ws.onclose = () => {
        socket = null;
        onStatusRef.current?.(false);
        retry();
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* already closing */
        }
      };
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        onResyncRef.current?.();
        if (!socket || socket.readyState > WebSocket.OPEN) {
          backoff = 1000;
          void connect();
        }
        return;
      }
      // Hidden: drop the socket. Nobody is looking, and holding it open is
      // exactly the cost this migration set out to remove - unless this screen
      // prints unattended, in which case being away is the whole point.
      if (keepOpenWhenHidden) return;
      if (timer) clearTimeout(timer);
      socket?.close();
      socket = null;
      onStatusRef.current?.(false);
    };

    void connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
      socket?.close();
      socket = null;
    };
  }, [key, enabled, keepOpenWhenHidden]);
}
