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
 *   • every reconnect calls `onResync` before anything else, because events
 *     that happened while disconnected are simply not replayed — the socket
 *     is a nudge, never the source of truth.
 *   • backoff caps at 30s so an outage settles into a slow retry rather than
 *     a tight loop across every open till in the country.
 */
import { useEffect, useRef } from "react";

type Frame = { event?: string; data?: Record<string, unknown> };

export interface UseRoomArgs {
  /** Body for POST /api/v1/realtime/token. */
  scope: { scope: "merchant" } | { scope: "order"; orderId: string };
  /** Called for every frame. Keep it stable (useCallback) or it reconnects. */
  onEvent: (event: string, data: Record<string, unknown>) => void;
  /** Called on connect, on reconnect, and when the tab returns to the front. */
  onResync?: () => void;
  enabled?: boolean;
}

export function useRoom({ scope, onEvent, onResync, enabled = true }: UseRoomArgs) {
  // Held in refs so a caller passing inline functions does not tear the
  // socket down and rebuild it on every render. Synced in an effect rather
  // than during render: React may render without committing, and writing a
  // ref on a render that is then thrown away leaves the socket calling a
  // handler that was never actually mounted.
  const onEventRef = useRef(onEvent);
  const onResyncRef = useRef(onResync);
  useEffect(() => {
    onEventRef.current = onEvent;
    onResyncRef.current = onResync;
  });

  const key = JSON.stringify(scope);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let backoff = 1000;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const retry = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30_000);
    };

    async function connect() {
      if (cancelled || document.visibilityState !== "visible") return;
      let cfg: { enabled?: boolean; url?: string; room?: string; token?: string } | null;
      try {
        const res = await fetch("/api/v1/realtime/token", {
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
      // exactly the cost this migration set out to remove.
      if (timer) clearTimeout(timer);
      socket?.close();
      socket = null;
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
  }, [key, enabled]);
}
