"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { GrowPaymentSdk, renderGrowWallet } from "@/components/customer/GrowPaymentSdk";
import {
  buildKioskT,
  type KioskOverrides,
} from "@/lib/i18n/kiosk-messages";

type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

interface PayPageProps {
  tenantSlug: string;
  tenantName: string;
  order: {
    id: string;
    number: string;
    total: number;
    paymentStatus: PaymentStatus | string;
    paymentMethod: string;
    invoiceNumber: string | null;
    invoiceUrl: string | null;
    customerEmailMasked: string | null;
  };
  growEnabled: boolean;
  growTestMode: boolean;
  initialAuthCode: string | null;
  stringOverrides: KioskOverrides;
  justPaid: boolean;
}

export function PayPage({
  tenantSlug,
  tenantName,
  order,
  growEnabled,
  growTestMode,
  initialAuthCode,
  stringOverrides,
  justPaid,
}: PayPageProps) {
  const t = useMemo(() => buildKioskT(stringOverrides), [stringOverrides]);
  const alreadyPaid = order.paymentStatus === "paid" || justPaid;
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | string>(
    order.paymentStatus,
  );
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(order.invoiceUrl);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(
    order.invoiceNumber,
  );
  const [emailMasked, setEmailMasked] = useState<string | null>(
    order.customerEmailMasked,
  );
  const [authCode, setAuthCode] = useState<string | null>(initialAuthCode);
  const [sdkReady, setSdkReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatedRef = useRef(!!initialAuthCode);

  async function startPayment() {
    if (initiatedRef.current) return;
    initiatedRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/customer/orders/${order.id}/pay/initiate`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();
      if (!res.ok || !data?.sdk_auth_code) {
        setError(
          typeof data?.error?.message === "string"
            ? data.error.message
            : t("payPage.openFailed"),
        );
        initiatedRef.current = false;
        return;
      }
      setAuthCode(data.sdk_auth_code);
    } catch {
      setError(t("payPage.network"));
      initiatedRef.current = false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!alreadyPaid && growEnabled && !authCode) {
      void startPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (authCode && sdkReady) {
      renderGrowWallet(authCode);
    }
  }, [authCode, sdkReady]);

  useEffect(() => {
    // Stop polling once we have everything we'd display: the payment is
    // settled AND the invoice URL has either arrived or we've given up
    // waiting (the timeout below caps invoice waiting at ~45s).
    const isPaid = alreadyPaid || paymentStatus === "paid";
    if (isPaid && invoiceUrl) return;
    let stopped = false;
    const paidAtMs = isPaid ? Date.now() : 0;
    const tick = async () => {
      if (stopped) return;
      try {
        const res = await fetch(`/api/v1/customer/orders/${order.id}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const nextStatus = data?.order?.payment_status;
        if (nextStatus && nextStatus !== paymentStatus) {
          setPaymentStatus(nextStatus);
        }
        const nextInvoiceUrl = data?.order?.invoice_url ?? null;
        const nextInvoiceNumber = data?.order?.invoice_number ?? null;
        if (nextInvoiceUrl && nextInvoiceUrl !== invoiceUrl) {
          setInvoiceUrl(nextInvoiceUrl);
        }
        if (nextInvoiceNumber && nextInvoiceNumber !== invoiceNumber) {
          setInvoiceNumber(nextInvoiceNumber);
        }
        const nextEmail = data?.order?.customer_email_masked ?? null;
        if (nextEmail !== emailMasked) setEmailMasked(nextEmail);
      } catch {
        /* ignore */
      }
      // Cap invoice polling: stop ~45s after paid even if Grow never
      // ships the invoice (some merchant accounts aren't configured for
      // invoice generation - we'd poll forever otherwise).
      if (paidAtMs && Date.now() - paidAtMs > 45_000) {
        stopped = true;
      }
    };
    void tick();
    const t = setInterval(tick, 3000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [
    order.id,
    paymentStatus,
    alreadyPaid,
    invoiceUrl,
    invoiceNumber,
    emailMasked,
  ]);


  if (alreadyPaid || paymentStatus === "paid") {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-qf-green-soft grid place-items-center">
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
          <h1 className="text-2xl font-black text-qf-ink">
            {t("payPage.paidHeading")}
          </h1>
          <p className="text-base text-qf-mute">
            {t("payPage.paidOrderLine", { number: order.number, tenantName })}
          </p>
          <p className="text-sm text-qf-mute">
            {t("payPage.paidAmountLine")}{" "}
            <span className="tnum font-bold">{formatPrice(order.total)}</span>
          </p>
        </div>

        {/* Invoice surface - two states only. The customer captures their
            email upfront on the kiosk name-entry screen now, so the
            phone pay page never asks for it. Render the download
            button as soon as Grow ships the invoice URL; otherwise show
            the quiet "we'll email it to you" note when the order
            carries a captured email. */}
        {invoiceUrl ? (
          <a
            href={invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-base font-bold shadow-md active:scale-[0.98] transition"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              aria-hidden
              className="text-white"
            >
              <path
                d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t("payPage.invoiceDownload")}
            {invoiceNumber && (
              <span className="text-xs text-white/80 tnum">#{invoiceNumber}</span>
            )}
          </a>
        ) : emailMasked ? (
          <div className="bg-(--qf-soft) rounded-2xl p-4 max-w-sm text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-sm text-(--qf-deep)">
              <span className="qf-spinner text-(--qf-primary)" aria-hidden />
              {t("payPage.invoiceGenerating")}
            </div>
            <p className="text-sm text-qf-ink">
              {t("payPage.invoiceWillEmailUnknown", { email: emailMasked ?? "" })}
            </p>
            <p className="text-xs text-qf-mute">{t("payPage.canCloseTabShort")}</p>
          </div>
        ) : null}

        <p className="text-sm text-qf-mute max-w-xs">
          {t("payPage.canCloseTab")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] p-5 flex flex-col gap-5">
      <header className="text-center pt-4">
        <h1 className="text-2xl font-black text-qf-ink">{t("payPage.payTitle")}</h1>
        <p className="text-sm text-qf-mute mt-1">
          {t("payPage.orderLine", { tenantName, number: order.number })}
        </p>
      </header>

      <div className="bg-white rounded-2xl border border-qf-line p-5 shadow-xs space-y-3 text-center">
        <div className="text-sm text-qf-mute">{t("payPage.totalLabel")}</div>
        <div className="text-5xl font-black tnum text-qf-ink">
          {formatPrice(order.total)}
        </div>
      </div>

      {!growEnabled ? (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-xl p-4 text-sm text-center">
          {t("payPage.notAvailable")}
        </div>
      ) : (
        <>
          <div className="bg-(--qf-soft) rounded-2xl p-5 text-center space-y-2">
            <div className="text-base font-bold text-(--qf-deep)">
              {busy
                ? t("payPage.openingWindow")
                : t("payPage.waitingForGrow")}
            </div>
            <p className="text-xs text-qf-mute">
              {t("payPage.securityNote")}
            </p>
          </div>

          {error && (
            <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-xl p-3 text-sm text-center">
              {error}
              <button
                type="button"
                onClick={() => {
                  initiatedRef.current = false;
                  setAuthCode(null);
                  void startPayment();
                }}
                className="block mx-auto mt-2 underline text-sm"
              >
                {t("payPage.tryAgain")}
              </button>
            </div>
          )}

          <GrowPaymentSdk
            testMode={growTestMode}
            thankYouUrl={`/s/${tenantSlug}/pay/${order.id}?paid=1`}
            onReady={() => setSdkReady(true)}
            onError={(message) => {
              setError(
                typeof message === "string"
                  ? message
                  : t("payPage.paymentFailed"),
              );
              initiatedRef.current = false;
              setAuthCode(null);
            }}
          />
        </>
      )}
    </div>
  );
}
