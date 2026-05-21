/**
 * Grow Payment SDK (Growin Wallet) — embedded inline wallet, no redirect.
 *
 * Loads the Grow JS SDK from cdn.meshulam.co.il and registers a singleton
 * `window.growPayment` instance with our event callbacks. The actual wallet
 * is rendered when the parent calls `renderGrowWallet(authCode)` after the
 * backend returns an authCode from `/pay/initiate`.
 *
 * Mounting this component is enough to load the SDK — it produces no UI.
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
  // document re-init behaviour — we call init() exactly once and forward
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
              propsRef.current.onError?.(
                response.message || JSON.stringify(response) || "התשלום נכשל",
              );
            },
            onError: (response) => {
              // eslint-disable-next-line no-console
              console.error("[grow-sdk] onError", response);
              propsRef.current.onError?.(
                response.message ||
                  JSON.stringify(response) ||
                  "אירעה שגיאה בעיבוד התשלום",
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
        // The SDK's init() is synchronous but it kicks off async work
        // (loading sub-frames, registering Apple Pay handlers, etc.).
        // Calling renderPaymentOptions before that finishes throws
        // "SDK was not loaded as needed". A short buffer lets the SDK
        // settle before we tell our parent it's safe to render.
        setTimeout(() => {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.info("[grow-sdk] ready");
          onReady?.();
        }, 800);
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

  // SDK renders its own UI — no markup here.
  return null;
}

/**
 * Trigger the wallet to render with the authCode from /pay/initiate.
 * Returns true if the SDK is ready, false otherwise.
 */
export function renderGrowWallet(authCode: string): boolean {
  if (typeof window === "undefined" || !window.growPayment) {
    // eslint-disable-next-line no-console
    console.error("[grow-sdk] renderGrowWallet called but SDK not loaded yet", {
      hasWindow: typeof window !== "undefined",
      hasGrowPayment: typeof window !== "undefined" && !!window.growPayment,
    });
    return false;
  }
  // eslint-disable-next-line no-console
  console.info("[grow-sdk] renderPaymentOptions", { authCode });
  window.growPayment.renderPaymentOptions(authCode);
  return true;
}
