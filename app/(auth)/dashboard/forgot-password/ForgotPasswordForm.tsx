"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthEmailField } from "@/components/shared/AuthFields";
import { IcoArrowLeft } from "@/components/shared/Icons";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError("השליחה נכשלה. נסו שוב בעוד רגע.");
        return;
      }
      setDone(true);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div className="bg-[#FFF2C9] border-2 border-black rounded-2xl px-4 py-4 text-sm text-black font-medium leading-relaxed shadow-[0_3px_0_#000]">
          אם הכתובת רשומה אצלנו, שלחנו אליה קישור לאיפוס סיסמה.
          הקישור תקף ל-30 דקות. בדקו גם את תיבת הספאם.
        </div>
        <Link
          href="/dashboard/login"
          className="block w-full text-center py-3.5 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black font-black text-base border-2 border-black shadow-[0_4px_0_#000] hover:shadow-[0_5px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition"
        >
          חזרה להתחברות
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <AuthEmailField
        id="email"
        label="אימייל"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
        required
      />

      {error && (
        <div className="bg-[#FFE2DC] border-2 border-black text-black text-sm font-bold rounded-xl px-3 py-2.5 shadow-[0_2px_0_#000]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !email}
        className="w-full py-3.5 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black font-black text-base border-2 border-black shadow-[0_4px_0_#000] hover:shadow-[0_5px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <span className="qf-spinner" aria-hidden />
            <span>שולח…</span>
          </>
        ) : (
          <>
            <span>שלח קישור איפוס</span>
            <IcoArrowLeft c="currentColor" s={16} />
          </>
        )}
      </button>

      <p className="text-xs text-black/60 text-center">
        נזכרת?{" "}
        <Link
          href="/dashboard/login"
          className="text-black font-black underline underline-offset-2"
        >
          חזרה להתחברות
        </Link>
      </p>
    </form>
  );
}
