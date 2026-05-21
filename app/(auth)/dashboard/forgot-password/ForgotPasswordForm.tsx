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
        <div className="bg-qf-green-soft border border-(--qf-primary)/30 text-qf-green-deep rounded-2xl px-4 py-4 text-sm">
          אם הכתובת רשומה אצלנו, שלחנו אליה קישור לאיפוס סיסמה.
          הקישור תקף ל-30 דקות. בדקו גם את תיבת הספאם.
        </div>
        <Link
          href="/dashboard/login"
          className="block w-full text-center py-3 rounded-xl bg-qf-ink hover:bg-black text-white text-sm font-medium transition"
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
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !email}
        className="w-full py-3 rounded-xl bg-qf-ink hover:bg-black text-white font-medium transition disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <span className="qf-spinner" aria-hidden />
            <span>שולח…</span>
          </>
        ) : (
          <>
            <span>שלח קישור איפוס</span>
            <IcoArrowLeft c="currentColor" s={14} />
          </>
        )}
      </button>

      <p className="text-xs text-qf-mute text-center">
        נזכרת?{" "}
        <Link href="/dashboard/login" className="text-qf-ink underline">
          חזרה להתחברות
        </Link>
      </p>
    </form>
  );
}
