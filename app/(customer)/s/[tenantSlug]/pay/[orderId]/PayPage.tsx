"use client";

import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { GrowPaymentSdk, renderGrowWallet } from "@/components/customer/GrowPaymentSdk";

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
    customerPhoneMasked: string | null;
    customerEmailMasked: string | null;
  };
  growEnabled: boolean;
  growTestMode: boolean;
  justPaid: boolean;
}

export function PayPage({
  tenantSlug,
  tenantName,
  order,
  growEnabled,
  growTestMode,
  justPaid,
}: PayPageProps) {
  const alreadyPaid = order.paymentStatus === "paid" || justPaid;
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | string>(
    order.paymentStatus,
  );
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(order.invoiceUrl);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(
    order.invoiceNumber,
  );
  const [phoneMasked, setPhoneMasked] = useState<string | null>(
    order.customerPhoneMasked,
  );
  const [emailMasked, setEmailMasked] = useState<string | null>(
    order.customerEmailMasked,
  );
  const [contactInput, setContactInput] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSentChannel, setContactSentChannel] = useState<
    "email" | "sms" | null
  >(null);
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiatedRef = useRef(false);

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
            : "לא הצלחנו לפתוח את חלון התשלום",
        );
        initiatedRef.current = false;
        return;
      }
      setAuthCode(data.sdk_auth_code);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
      initiatedRef.current = false;
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!alreadyPaid && growEnabled) {
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
        const nextPhone = data?.order?.customer_phone_masked ?? null;
        const nextEmail = data?.order?.customer_email_masked ?? null;
        if (nextPhone !== phoneMasked) setPhoneMasked(nextPhone);
        if (nextEmail !== emailMasked) setEmailMasked(nextEmail);
      } catch {
        /* ignore */
      }
      // Cap invoice polling: stop ~45s after paid even if Grow never
      // ships the invoice (some merchant accounts aren't configured for
      // invoice generation — we'd poll forever otherwise).
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
    phoneMasked,
    emailMasked,
  ]);

  async function submitContact() {
    const value = contactInput.trim();
    if (!value) return;
    setContactBusy(true);
    setContactError(null);
    try {
      const res = await fetch(
        `/api/v1/customer/orders/${order.id}/invoice-contact`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contact: value }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setContactError(
          typeof data?.error?.message === "string"
            ? data.error.message
            : "שגיאה בשמירה",
        );
        return;
      }
      const channel: "email" | "sms" =
        data?.channel === "email" ? "email" : "sms";
      setContactSentChannel(channel);
      setContactInput("");
      // Optimistic: stamp local state so the UI flips to the "we'll send"
      // notice immediately. The polling loop will replace it with the
      // server-side mask within ~3s.
      if (channel === "email") setEmailMasked(value);
      else setPhoneMasked(value);
    } catch {
      setContactError("שגיאת רשת. נסו שוב.");
    } finally {
      setContactBusy(false);
    }
  }

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
          <h1 className="text-2xl font-black text-qf-ink">התשלום הושלם</h1>
          <p className="text-base text-qf-mute">
            הזמנה #{order.number} התקבלה ב{tenantName}.
          </p>
          <p className="text-sm text-qf-mute">
            סכום ששולם: <span className="tnum font-bold">{formatPrice(order.total)}</span>
          </p>
        </div>

        {/* Invoice surface — three states:
            (1) Invoice URL ready → big download button (immediate path).
            (2) Invoice not ready but we have a phone/email → quiet "we'll
                send it to you" note. The dispatcher fires the moment Grow
                ships, so the customer can safely close the tab.
            (3) Invoice not ready AND no contact captured → inline form so
                the customer can drop a phone or email. */}
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
            הורדת חשבונית מס/קבלה
            {invoiceNumber && (
              <span className="text-xs text-white/80 tnum">#{invoiceNumber}</span>
            )}
          </a>
        ) : phoneMasked || emailMasked ? (
          <div className="bg-(--qf-soft) rounded-2xl p-4 max-w-sm text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-sm text-(--qf-deep)">
              <span className="qf-spinner text-(--qf-primary)" aria-hidden />
              מייצרים חשבונית…
            </div>
            <p className="text-sm text-qf-ink">
              {phoneMasked && emailMasked
                ? `נשלח לך באסמס ל-${phoneMasked} ובמייל ל-${emailMasked} ברגע שתהיה מוכנה.`
                : phoneMasked
                  ? `נשלח לך באסמס ל-${phoneMasked} ברגע שתהיה מוכנה.`
                  : `נשלח לך במייל ל-${emailMasked} ברגע שתהיה מוכנה.`}
            </p>
            <p className="text-xs text-qf-mute">אפשר לסגור את החלון.</p>
          </div>
        ) : contactSentChannel ? (
          <div className="bg-qf-green-soft rounded-2xl p-4 max-w-sm text-center space-y-1">
            <div className="text-sm font-bold text-qf-green-deep">
              {contactSentChannel === "email"
                ? "נשלח במייל ברגע שתהיה מוכנה"
                : "נשלח באסמס ברגע שתהיה מוכנה"}
            </div>
            <p className="text-xs text-qf-mute">אפשר לסגור את החלון.</p>
          </div>
        ) : (
          <div className="w-full max-w-sm bg-white rounded-2xl border border-qf-line p-4 space-y-3">
            <div className="text-sm font-bold text-qf-ink text-center">
              לאן לשלוח את החשבונית?
            </div>
            <p className="text-xs text-qf-mute text-center">
              טלפון לאסמס או מייל — נשלח ברגע שתהיה מוכנה.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                value={contactInput}
                onChange={(e) => setContactInput(e.target.value)}
                placeholder="050-1234567 או name@example.com"
                dir="ltr"
                className="flex-1 px-3 py-3 rounded-xl border-2 border-qf-line-dash focus:border-(--qf-primary) outline-none text-sm bg-white"
              />
              <button
                type="button"
                onClick={submitContact}
                disabled={contactBusy || contactInput.trim().length < 3}
                className="px-5 py-3 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition"
              >
                {contactBusy ? "שולח…" : "שליחה"}
              </button>
            </div>
            {contactError && (
              <p className="text-xs text-qf-tomato text-center">{contactError}</p>
            )}
          </div>
        )}

        <p className="text-sm text-qf-mute max-w-xs">
          אפשר לסגור את החלון. ההזמנה כבר נשלחה למטבח.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] p-5 flex flex-col gap-5">
      <header className="text-center pt-4">
        <h1 className="text-2xl font-black text-qf-ink">תשלום הזמנה</h1>
        <p className="text-sm text-qf-mute mt-1">
          {tenantName} · הזמנה #{order.number}
        </p>
      </header>

      <div className="bg-white rounded-2xl border border-qf-line p-5 shadow-xs space-y-3 text-center">
        <div className="text-sm text-qf-mute">סה״כ לתשלום</div>
        <div className="text-5xl font-black tnum text-qf-ink">
          {formatPrice(order.total)}
        </div>
      </div>

      {!growEnabled ? (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato rounded-xl p-4 text-sm text-center">
          תשלום אונליין לא זמין כרגע למסעדה זו. נא לפנות לקופה.
        </div>
      ) : (
        <>
          <div className="bg-(--qf-soft) rounded-2xl p-5 text-center space-y-2">
            <div className="text-base font-bold text-(--qf-deep)">
              {busy ? "טוען את חלון התשלום..." : "ממתינים לטופס מ-Grow"}
            </div>
            <p className="text-xs text-qf-mute">
              סליקה מאובטחת. אנא אל תסגרו את החלון עד סיום התשלום.
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
                נסה שוב
              </button>
            </div>
          )}

          <GrowPaymentSdk
            testMode={growTestMode}
            thankYouUrl={`/s/${tenantSlug}/pay/${order.id}?paid=1`}
            onReady={() => setSdkReady(true)}
            onError={(message) => {
              setError(typeof message === "string" ? message : "התשלום נכשל");
              initiatedRef.current = false;
              setAuthCode(null);
            }}
          />
        </>
      )}
    </div>
  );
}
