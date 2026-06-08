"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthEmailField, AuthPasswordField } from "@/components/shared/AuthFields";
import { IcoArrowLeft } from "@/components/shared/Icons";
import { trackCustom } from "@/lib/fb/pixel";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/merchant/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, client_type: "web" }),
      });
      const data = (await res.json()) as
        | { user: { role: string } }
        | { error: { message: string } };
      if (!res.ok) {
        setError("error" in data ? data.error.message : "התחברות נכשלה");
        return;
      }
      const role = "user" in data ? data.user.role : "";
      trackCustom("Login", { role }, { email: email.toLowerCase() });
      router.push(
        role === "platform_admin"
          ? "/admin"
          : role === "kitchen"
            ? "/dashboard/kitchen"
            : role === "cashier"
              ? "/pos"
              : "/dashboard",
      );
      router.refresh();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
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

      <AuthPasswordField
        id="password"
        label="סיסמה"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        required
        actionRight={
          <Link
            href="/dashboard/forgot-password"
            className="text-xs font-bold text-black/60 hover:text-black underline underline-offset-2 decoration-black/40 hover:decoration-black"
          >
            שכחת סיסמה?
          </Link>
        }
      />

      {error && (
        <div className="bg-[#FFE2DC] border-2 border-black text-black text-sm font-bold rounded-xl px-3 py-2.5 shadow-[0_2px_0_#000]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3.5 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black font-black text-base border-2 border-black shadow-[0_4px_0_#000] hover:shadow-[0_5px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <span className="qf-spinner" aria-hidden />
            <span>מתחבר…</span>
          </>
        ) : (
          <>
            <span>התחבר</span>
            <IcoArrowLeft c="currentColor" s={16} />
          </>
        )}
      </button>

      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 h-[2px] bg-black/15" />
        <span className="text-xs font-bold text-black/55 tracking-wider">או</span>
        <div className="flex-1 h-[2px] bg-black/15" />
      </div>

      <Link
        href="/signup"
        className="block w-full text-center py-3 rounded-xl bg-white border-2 border-black hover:bg-[#FFFBEC] text-sm font-bold text-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition"
      >
        צור חשבון חדש
      </Link>

      <p className="text-[10px] text-black/55 text-center leading-relaxed">
        בהמשך אתה מסכים ל-
        <Link href="/terms" className="underline font-bold text-black/70 hover:text-black">
          תנאי השימוש
        </Link>{" "}
        ול-
        <Link href="/privacy" className="underline font-bold text-black/70 hover:text-black">
          מדיניות הפרטיות
        </Link>
      </p>
    </form>
  );
}
