"use client";

import { useState } from "react";

export interface OtpCustomer {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
}

/**
 * Reusable phone-OTP login form (phone step → code step). Shared by the
 * personal-area login page and the checkout "already a customer?" sheet so
 * the auth UX stays in one place. On success it calls onSuccess with the
 * customer payload; the web verify call also sets the session cookies.
 */
export function CustomerOtpLogin({
  tenantSlug,
  onSuccess,
  autoFocus = true,
}: {
  tenantSlug?: string;
  onSuccess: (customer: OtpCustomer) => void;
  autoFocus?: boolean;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, tenant_slug: tenantSlug }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error?.message ?? "שגיאה");
        return;
      }
      setStep("code");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code, client_type: "web" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error?.message ?? "קוד שגוי");
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (d.customer) onSuccess(d.customer as OtpCustomer);
    } finally {
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <div className="space-y-3">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0501234567"
          dir="ltr"
          inputMode="tel"
          autoFocus={autoFocus}
          className="w-full bg-white px-4 py-3 rounded-2xl border border-qf-line focus:border-(--qf-primary) outline-none text-center text-lg tnum"
        />
        {error && (
          <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={requestOtp}
          disabled={!phone || busy}
          className="w-full py-3 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-medium disabled:opacity-60"
        >
          {busy ? "שולח..." : "המשך"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-qf-mute text-center" dir="ltr">
        {phone}{" "}
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setCode("");
            setError(null);
          }}
          className="text-(--qf-deep) underline"
        >
          שינוי
        </button>
      </div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        dir="ltr"
        inputMode="numeric"
        maxLength={6}
        autoFocus={autoFocus}
        className="w-full bg-white px-4 py-3 rounded-2xl border border-qf-line focus:border-(--qf-primary) outline-none text-center text-2xl tnum tracking-widest"
      />
      {error && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={verifyOtp}
        disabled={code.length !== 6 || busy}
        className="w-full py-3 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-medium disabled:opacity-60"
      >
        {busy ? "מאמת..." : "התחבר"}
      </button>
      <div className="text-xs text-qf-mute text-center">
        הקוד נשלח אליך בוואטסאפ. לא הגיע? נסה שוב בעוד רגע.
      </div>
    </div>
  );
}
