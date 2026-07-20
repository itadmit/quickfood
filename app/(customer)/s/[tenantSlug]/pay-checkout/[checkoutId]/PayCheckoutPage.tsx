"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { GrowPaymentSdk, renderGrowWallet } from "@/components/customer/GrowPaymentSdk";
import { HostedPaymentFrame } from "@/components/customer/HostedPaymentFrame";
import {
  buildKioskT,
  type KioskOverrides,
} from "@/lib/i18n/kiosk-messages";

interface Props {
  tenantSlug: string;
  tenantName: string;
  checkout: {
    id: string;
    amount: number;
    status: string;
    orderId: string | null;
    expiresAt: string;
  };
  cardEnabled: boolean;
  provider: "grow" | "cardcom" | null;
  testMode: boolean;
  displayMode: "iframe" | "redirect" | null;
  initialAuthCode: string | null;
  initialPaymentUrl: string | null;
  stringOverrides: KioskOverrides;
}

export function PayCheckoutPage({
  tenantSlug,
  tenantName,
  checkout,
  cardEnabled,
  provider,
  testMode,
  displayMode,
  initialAuthCode,
  initialPaymentUrl,
  stringOverrides,
}: Props) {
  const t = useMemo(() => buildKioskT(stringOverrides), [stringOverrides]);
  const [status, setStatus] = useState(checkout.status);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState<string | null>(initialAuthCode);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(initialPaymentUrl);
  const [sdkReady, setSdkReady] = useState(false);
  const [walletOpenedOnce, setWalletOpenedOnce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatedRef = useRef(!!initialAuthCode || !!initialPaymentUrl);

  async function startPayment() {
    if (initiatedRef.current) return;
    initiatedRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/customer/kiosk-checkout/${checkout.id}/pay/initiate`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();
      if (!res.ok || (!data?.sdk_auth_code && !data?.payment_url)) {
        setError(
          typeof data?.error?.message === "string"
            ? data.error.message
            : t("payPage.openFailed"),
        );
        initiatedRef.current = false;
        return;
      }
      if (data.sdk_auth_code) setAuthCode(data.sdk_auth_code);
      else if (data.payment_url) setPaymentUrl(data.payment_url);
    } catch {
      setError(t("payPage.network"));
      initiatedRef.current = false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (status === "pending" && cardEnabled && !authCode && !paymentUrl) {
      void startPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (provider === "grow" && authCode && sdkReady) {
      renderGrowWallet(authCode);
    }
  }, [provider, authCode, sdkReady]);

  useEffect(() => {
    if (status === "completed") return;
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch(
          `/api/v1/customer/kiosk-checkout/${checkout.id}`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const data = await res.json();
        const nextStatus = data?.checkout?.status as string | undefined;
        if (nextStatus && nextStatus !== status) setStatus(nextStatus);
        const nextOrderNumber = data?.order?.number as string | undefined;
        if (nextOrderNumber) setOrderNumber(nextOrderNumber);
      } catch {
        /* keep polling */
      }
    };
    void tick();
    const h = setInterval(tick, 3000);
    return () => {
      stopped = true;
      clearInterval(h);
    };
  }, [checkout.id, status]);

  if (status === "completed") {
    return (
      <div className="min-h-[80vh] max-w-md mx-auto flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-(--qf-soft) grid place-items-center">
          <svg
            viewBox="0 0 24 24"
            width="40"
            height="40"
            fill="none"
            aria-hidden
            className="text-qf-green-deep"
          >
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-qf-ink">{t("payPage.paidHeading")}</h1>
          {orderNumber && (
            <p className="text-sm text-qf-mute tnum">
              {t("payPage.paidOrderLine", {
                number: orderNumber,
                tenantName,
              })}
            </p>
          )}
          <p className="text-sm text-qf-mute">
            {t("payPage.paidAmountLine")}{" "}
            <span className="tnum font-bold">{formatPrice(checkout.amount)}</span>
          </p>
        </div>
        <p className="text-sm text-qf-mute max-w-xs">{t("payPage.canCloseTab")}</p>
      </div>
    );
  }

  if (status === "abandoned") {
    return (
      <div className="min-h-[80vh] max-w-md mx-auto flex flex-col items-center justify-center gap-6 p-6 text-center">
        <h1 className="text-2xl font-black text-qf-ink">התשלום בוטל</h1>
        <p className="text-sm text-qf-mute max-w-xs">חזרו לקיוסק להתחיל מחדש</p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] max-w-md mx-auto p-5 flex flex-col gap-5">
      <header className="text-center pt-4">
        <h1 className="text-2xl font-black text-qf-ink">{t("payPage.payTitle")}</h1>
        <p className="text-sm text-qf-mute mt-1">{tenantName}</p>
      </header>

      <div className="bg-white rounded-2xl border border-qf-line p-5 shadow-xs space-y-3 text-center">
        <div className="text-sm text-qf-mute">{t("payPage.totalLabel")}</div>
        <div className="text-5xl font-black tnum text-qf-ink">
          {formatPrice(checkout.amount)}
        </div>
      </div>

      {!cardEnabled ? (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-xl p-4 text-sm text-center">
          {t("payPage.notAvailable")}
        </div>
      ) : (
        <>
          <div className="bg-(--qf-soft) rounded-2xl p-5 text-center flex flex-col items-center gap-3">
            {!walletOpenedOnce ? (
              <svg
                className="w-7 h-7 animate-spin text-(--qf-deep)"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity="0.2"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            ) : null}
            <div className="text-base font-bold text-(--qf-deep)">
              {busy ? t("payPage.openingWindow") : t("payPage.waitingForGrow")}
            </div>
            <p className="text-xs text-qf-mute">{t("payPage.securityNote")}</p>
            {walletOpenedOnce && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-(--qf-deep) text-white text-sm font-bold hover:opacity-90 active:scale-[0.98] transition"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                רענון העמוד
              </button>
            )}
          </div>

          {error && (
            <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-xl p-3 text-sm text-center">
              {error}
              <button
                type="button"
                onClick={() => {
                  initiatedRef.current = false;
                  setAuthCode(null);
                  setPaymentUrl(null);
                  void startPayment();
                }}
                className="block mx-auto mt-2 underline text-sm"
              >
                {t("payPage.tryAgain")}
              </button>
            </div>
          )}

          {provider === "cardcom" ? (
            paymentUrl && (
              <HostedPaymentFrame
                paymentUrl={paymentUrl}
                displayMode={displayMode ?? "redirect"}
              />
            )
          ) : (
            <GrowPaymentSdk
              testMode={testMode}
              thankYouUrl={`/s/${tenantSlug}/pay-checkout/${checkout.id}`}
              onReady={() => setSdkReady(true)}
              onWalletChange={(state) => {
                if (state === "open") setWalletOpenedOnce(true);
              }}
              onError={(message) => {
                setError(
                  typeof message === "string" ? message : t("payPage.paymentFailed"),
                );
                initiatedRef.current = false;
                setAuthCode(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
