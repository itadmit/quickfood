"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPasswordField } from "@/components/shared/AuthFields";
import { IcoArrowLeft } from "@/components/shared/Icons";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingToken = !token;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("הסיסמה חייבת להכיל לפחות 8 תווים");
      return;
    }
    if (password !== confirm) {
      setError("הסיסמאות לא תואמות");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "השמירה נכשלה");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/dashboard/login"), 1500);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  if (missingToken) {
    return (
      <div className="space-y-5">
        <div className="bg-[#FFE2DC] border-2 border-black rounded-2xl px-4 py-4 text-sm text-black font-medium shadow-[0_3px_0_#000]">
          קישור לא תקין. נסו לבקש קישור חדש בעמוד &quot;שכחת סיסמה&quot;.
        </div>
        <Link
          href="/dashboard/forgot-password"
          className="block w-full text-center py-3.5 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black font-black text-base border-2 border-black shadow-[0_4px_0_#000] hover:shadow-[0_5px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition"
        >
          בקשת קישור חדש
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div className="bg-[#FFF2C9] border-2 border-black rounded-2xl px-4 py-4 text-sm text-black font-medium shadow-[0_3px_0_#000]">
          הסיסמה שונתה בהצלחה. מעבירים אותך להתחברות…
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <AuthPasswordField
        id="password"
        label="סיסמה חדשה"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        required
      />
      <AuthPasswordField
        id="confirm"
        label="אישור סיסמה"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        required
      />

      {error && (
        <div className="bg-[#FFE2DC] border-2 border-black text-black text-sm font-bold rounded-xl px-3 py-2.5 shadow-[0_2px_0_#000]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !password || !confirm}
        className="w-full py-3.5 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black font-black text-base border-2 border-black shadow-[0_4px_0_#000] hover:shadow-[0_5px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <span className="qf-spinner" aria-hidden />
            <span>שומר…</span>
          </>
        ) : (
          <>
            <span>שמירת סיסמה</span>
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
