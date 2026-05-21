"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IcoPhoneSms } from "@/components/shared/Icons";

export function ProfileLogin() {
  const router = useRouter();
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
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) {
        const d = await res.json();
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
        const d = await res.json();
        setError(d.error?.message ?? "קוד שגוי");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 py-8 space-y-4 lg:max-w-md lg:mx-auto lg:p-8 lg:bg-white lg:border lg:border-qf-line lg:rounded-3xl lg:shadow-xs lg:mt-6">
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-qf-green-soft grid place-items-center mb-3">
          <IcoPhoneSms c="var(--qf-primary)" s={36} />
        </div>
        <h2 className="text-xl font-bold">התחברות עם טלפון</h2>
        <p className="text-sm text-qf-mute mt-1">
          {step === "phone" ? "נשלח לך קוד אימות ב-SMS" : "הזן את הקוד שקיבלת"}
        </p>
      </div>

      {step === "phone" ? (
        <div className="space-y-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="050-1234567"
            dir="ltr"
            inputMode="tel"
            autoFocus
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
      ) : (
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
            autoFocus
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
            ב-MVP הקוד נכתב ל-server console — בדוק את הלוג
          </div>
        </div>
      )}
    </div>
  );
}
