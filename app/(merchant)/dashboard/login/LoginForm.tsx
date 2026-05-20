"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      router.push(role === "platform_admin" ? "/admin" : "/dashboard/orders");
      router.refresh();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="email">
          אימייל
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) focus:outline-none transition"
        />
      </div>
      <div className="space-y-1.5">
        <label className="block text-sm font-medium" htmlFor="password">
          סיסמה
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-qf-line-dash focus:border-(--qf-primary) focus:outline-none transition"
        />
      </div>
      {error && (
        <div className="bg-qf-tomato-soft border border-qf-tomato/40 text-qf-tomato text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 rounded-xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white font-medium transition disabled:opacity-60"
      >
        {busy ? "מתחבר..." : "התחברות"}
      </button>
      <div className="text-xs text-qf-mute text-center">
        Seed demo: owner@pizzeria-verde.local · verde1234
      </div>
    </form>
  );
}
