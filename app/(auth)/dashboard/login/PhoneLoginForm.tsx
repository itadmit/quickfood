"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPhoneField, AuthCodeField } from "@/components/shared/AuthFields";
import { IcoArrowLeft } from "@/components/shared/Icons";
import { trackCustom } from "@/lib/fb/pixel";

const ROLE_HOME: Record<string, string> = {
  platform_admin: "/admin",
  kitchen: "/dashboard/kitchen",
  cashier: "/pos",
};

export default function PhoneLoginForm({ onUseEmail }: { onUseEmail?: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "שליחת הקוד נכשלה");
        return;
      }
      setStep("code");
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/auth/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code, client_type: "web" }),
      });
      const data = (await res.json()) as
        | { user: { role: string } }
        | { error: { message: string } };
      if (!res.ok) {
        setError("error" in data ? data.error.message : "התחברות נכשלה");
        return;
      }
      const role = "user" in data ? data.user.role : "";
      trackCustom("Login", { role, method: "phone_otp" });
      router.push(ROLE_HOME[role] ?? "/dashboard");
      router.refresh();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={step === "phone" ? requestCode : verifyCode} className="space-y-5">
      {step === "phone" ? (
        <AuthPhoneField
          id="phone"
          label="מספר טלפון"
          value={phone}
          onChange={setPhone}
          required
        />
      ) : (
        <>
          <AuthCodeField
            id="code"
            label="קוד מהוואטסאפ"
            value={code}
            onChange={setCode}
            required
          />
          <p className="text-xs text-black/55 font-semibold text-center">
            שלחנו קוד בן 6 ספרות בוואטסאפ ל-{phone}.{" "}
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError(null);
              }}
              className="underline font-bold text-black/70 hover:text-black"
            >
              שינוי מספר
            </button>
          </p>
        </>
      )}

      {error && (
        <div className="bg-[#FFE2DC] border-2 border-black text-black text-sm font-bold rounded-xl px-3 py-2.5 shadow-[0_2px_0_#000]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || (step === "code" && code.length !== 6)}
        className="w-full py-3.5 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black font-black text-base border-2 border-black shadow-[0_4px_0_#000] hover:shadow-[0_5px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <span className="qf-spinner" aria-hidden />
            <span>{step === "phone" ? "שולח קוד…" : "מתחבר…"}</span>
          </>
        ) : (
          <>
            <span>{step === "phone" ? "שלח לי קוד בוואטסאפ" : "התחבר"}</span>
            <IcoArrowLeft c="currentColor" s={16} />
          </>
        )}
      </button>

      {onUseEmail && (
        <>
          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 h-[2px] bg-black/15" />
            <span className="text-xs font-bold text-black/55 tracking-wider">או</span>
            <div className="flex-1 h-[2px] bg-black/15" />
          </div>

          <button
            type="button"
            onClick={onUseEmail}
            className="block w-full text-center py-3 rounded-xl bg-white border-2 border-black hover:bg-[#FFFBEC] text-sm font-bold text-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition"
          >
            התחברות עם אימייל וסיסמה
          </button>
        </>
      )}
    </form>
  );
}
