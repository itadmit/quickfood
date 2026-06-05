/**
 * Grow Payment SDK (Growin Wallet) - embedded inline wallet, no redirect.
 *
 * Loads the Grow JS SDK from cdn.meshulam.co.il and registers a singleton
 * `window.growPayment` instance with our event callbacks. The actual wallet
 * is rendered when the parent calls `renderGrowWallet(authCode)` after the
 * backend returns an authCode from `/pay/initiate`.
 *
 * Mounting this component is enough to load the SDK - it produces no UI.
 * The wallet itself is owned and rendered by Grow's SDK as an overlay.
 *
 * SDK URL: https://cdn.meshulam.co.il/sdk/gs.min.js
 * init({ environment, version, events })
 * renderPaymentOptions(authCode)
 *
 * Ported from QuickShop10's grow-payment-sdk.tsx (kept the same event shape).
 */

"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    growPayment?: {
      init: (config: GrowSdkConfig) => void;
      renderPaymentOptions: (authCode: string) => void;
    };
  }
}

interface GrowSdkSuccessResponse {
  status: 1;
  data?: {
    payment_sum?: string;
    full_name?: string;
    payment_method?: string;
    number_of_payments?: number;
    confirmation_number?: string;
  };
}

interface GrowSdkErrorResponse {
  status: 0;
  message?: string;
}

interface GrowSdkConfig {
  environment: "DEV" | "PRODUCTION";
  version: 1;
  events: {
    onSuccess?: (response: GrowSdkSuccessResponse) => void;
    onFailure?: (response: GrowSdkErrorResponse) => void;
    onError?: (response: GrowSdkErrorResponse) => void;
    onTimeout?: (response: GrowSdkErrorResponse) => void;
    onWalletChange?: (state: "open" | "close") => void;
    onPaymentStart?: () => void;
    onPaymentCancel?: () => void;
  };
}

const SDK_URL = "https://cdn.meshulam.co.il/sdk/gs.min.js";

/**
 * The Grow SDK's failure payloads aren't strict - `message` is occasionally a
 * nested object (e.g. `{id, message}`). The parent renders our error as a
 * React child, so we MUST hand back a string. Without this coercion a single
 * non-string `message` trips React #31 on the entire checkout screen.
 */
function coerceSdkMessage(response: unknown, fallback: string): string {
  if (response && typeof response === "object") {
    const msg = (response as { message?: unknown }).message;
    if (typeof msg === "string" && msg) return msg;
    if (msg && typeof msg === "object") {
      const inner = (msg as { message?: unknown }).message;
      if (typeof inner === "string" && inner) return inner;
    }
    try {
      const j = JSON.stringify(response);
      if (j && j !== "{}") return j;
    } catch {
      // fall through
    }
  }
  if (typeof response === "string" && response) return response;
  return fallback;
}

interface GrowPaymentSdkProps {
  testMode: boolean;
  thankYouUrl: string;
  onError?: (message: string) => void;
  onWalletChange?: (state: "open" | "close") => void;
  onReady?: () => void;
}

let sdkLoadingPromise: Promise<void> | null = null;

function loadGrowSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.growPayment) return Promise.resolve();
  if (sdkLoadingPromise) return sdkLoadingPromise;

  sdkLoadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SDK_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Grow SDK failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Grow SDK failed to load"));
    document.head.appendChild(script);
  });
  return sdkLoadingPromise;
}

export function GrowPaymentSdk({
  testMode,
  thankYouUrl,
  onError,
  onWalletChange,
  onReady,
}: GrowPaymentSdkProps) {
  // Stable ref so we don't re-init the SDK every render. Grow's SDK doesn't
  // document re-init behaviour - we call init() exactly once and forward
  // events through this ref.
  const propsRef = useRef({ thankYouUrl, onError, onWalletChange });
  useEffect(() => {
    propsRef.current = { thankYouUrl, onError, onWalletChange };
  }, [thankYouUrl, onError, onWalletChange]);

  const initializedRef = useRef(false);
  const navigatingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    loadGrowSdk()
      .then(() => {
        if (cancelled || !window.growPayment) return;
        if (initializedRef.current) {
          onReady?.();
          return;
        }

        // eslint-disable-next-line no-console
        console.info("[grow-sdk] init", { environment: testMode ? "DEV" : "PRODUCTION" });
        window.growPayment.init({
          environment: testMode ? "DEV" : "PRODUCTION",
          version: 1,
          events: {
            onSuccess: (response) => {
              // eslint-disable-next-line no-console
              console.info("[grow-sdk] onSuccess", response);
              if (navigatingRef.current) return;
              navigatingRef.current = true;
              window.location.href = propsRef.current.thankYouUrl;
            },
            onFailure: (response) => {
              // eslint-disable-next-line no-console
              console.warn("[grow-sdk] onFailure", response);
              propsRef.current.onError?.(coerceSdkMessage(response, "התשלום נכשל"));
            },
            onError: (response) => {
              // eslint-disable-next-line no-console
              console.error("[grow-sdk] onError", response);
              propsRef.current.onError?.(
                coerceSdkMessage(response, "אירעה שגיאה בעיבוד התשלום"),
              );
            },
            onTimeout: (response) => {
              // eslint-disable-next-line no-console
              console.warn("[grow-sdk] onTimeout", response);
              propsRef.current.onError?.("פג תוקף הטופס. נסה שוב.");
            },
            onWalletChange: (state) => {
              // eslint-disable-next-line no-console
              console.info("[grow-sdk] onWalletChange", state);
              propsRef.current.onWalletChange?.(state);
            },
            onPaymentStart: () => {
              // eslint-disable-next-line no-console
              console.info("[grow-sdk] onPaymentStart");
            },
            onPaymentCancel: () => {
              // eslint-disable-next-line no-console
              console.info("[grow-sdk] onPaymentCancel");
              // Treat cancel like an error so we drop pendingPayment and
              // let the merchant try again.
              propsRef.current.onError?.("התשלום בוטל");
            },
          },
        });
        initializedRef.current = true;
        // The SDK's init() is synchronous but kicks off async sub-frame
        // loading. Calling renderPaymentOptions before those iframes are
        // ready makes the SDK render its own "SDK was not loaded as needed"
        // error message into the wallet div - and (in current versions) it
        // does NOT throw, so our retry-on-catch in renderGrowWallet won't
        // fire. So we still wait a baseline before signalling ready, just
        // shorter than the original 800ms now that preload+SSR-initiate
        // have already moved the script into cache by this point.
        setTimeout(() => {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.info("[grow-sdk] ready");
          onReady?.();
        }, 400);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load payment SDK";
        // eslint-disable-next-line no-console
        console.error("[grow-sdk] load failed", err);
        propsRef.current.onError?.(msg);
      });

    return () => {
      cancelled = true;
    };
  }, [testMode, onReady]);

  // SDK renders its own UI - no markup here.
  return null;
}

/**
 * Trigger the wallet to render with the authCode from /pay/initiate.
 * Retries internally if the SDK's async sub-frame loading hasn't finished
 * yet (it throws "SDK was not loaded as needed" until then). Backs off
 * every 60ms up to ~1.5s - typical real-world settle is <200ms.
 */
export function renderGrowWallet(authCode: string): boolean {
  if (typeof window === "undefined") return false;
  if (!window.growPayment) {
    // eslint-disable-next-line no-console
    console.error("[grow-sdk] renderGrowWallet called but SDK not loaded yet");
    return false;
  }

  const startedAt = Date.now();
  const MAX_WAIT_MS = 1500;
  const RETRY_MS = 60;

  const attempt = (): void => {
    if (!window.growPayment) return;
    try {
      window.growPayment.renderPaymentOptions(authCode);
      // eslint-disable-next-line no-console
      console.info("[grow-sdk] renderPaymentOptions ok", {
        waitedMs: Date.now() - startedAt,
      });
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= MAX_WAIT_MS) {
        // eslint-disable-next-line no-console
        console.error("[grow-sdk] renderPaymentOptions gave up", { elapsed, err });
        return;
      }
      setTimeout(attempt, RETRY_MS);
    }
  };

  attempt();
  return true;
}
