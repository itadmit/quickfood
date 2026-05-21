"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthEmailField, AuthPasswordField } from "@/components/shared/AuthFields";
import { IcoArrowLeft } from "@/components/shared/Icons";

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
      router.push(role === "platform_admin" ? "/admin" : "/dashboard");
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
            className="text-xs text-qf-mute hover:text-qf-ink"
          >
            שכחת סיסמה?
          </Link>
        }
      />

      {error && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 rounded-xl bg-qf-ink hover:bg-black text-white font-medium transition disabled:opacity-70 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <span className="qf-spinner" aria-hidden />
            <span>מתחבר…</span>
          </>
        ) : (
          <>
            <span>התחבר</span>
            <IcoArrowLeft c="currentColor" s={14} />
          </>
        )}
      </button>

      <div className="relative flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-qf-line-dash" />
        <span className="text-xs text-qf-mute">או</span>
        <div className="flex-1 h-px bg-qf-line-dash" />
      </div>

      <Link
        href="/signup"
        className="block w-full text-center py-3 rounded-xl bg-white border border-qf-line-dash hover:border-qf-ink text-sm font-medium transition"
      >
        צור חשבון חדש
      </Link>

      <p className="text-[10px] text-qf-mute text-center">
        בהמשך אתה מסכים ל-
        <a href="#" className="underline">תנאי השימוש</a>
        {" "}ו-{" "}
        <a href="#" className="underline">מדיניות הפרטיות</a>
      </p>

      <p className="text-[10px] text-qf-mute/70 text-center">
        Seed demo: owner@pizzeria-verde.local · verde1234
      </p>
    </form>
  );
}
