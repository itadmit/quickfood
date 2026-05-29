"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "pin" | "magic";

export function CourierLoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("pin");
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [magicEmail, setMagicEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState(false);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !/^\d{4,6}$/.test(pin)) {
      setError("מלאו טלפון/מייל ו-PIN בן 4-6 ספרות");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/courier/auth/login-pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), pin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error?.message ?? "התחברות נכשלה");
        return;
      }
      router.push("/courier/home");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitMagic(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!magicEmail.trim()) {
      setError("הזינו מייל");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/courier/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: magicEmail.trim() }),
      });
      if (!res.ok) {
        setError("שליחת קישור נכשלה");
        return;
      }
      setSentEmail(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
        <button
          type="button"
          onClick={() => {
            setMode("pin");
            setError(null);
          }}
          className={`py-2 rounded-lg text-sm font-medium transition ${
            mode === "pin" ? "bg-white text-[#0b1a14]" : "text-white/70"
          }`}
        >
          PIN
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("magic");
            setError(null);
            setSentEmail(false);
          }}
          className={`py-2 rounded-lg text-sm font-medium transition ${
            mode === "magic" ? "bg-white text-[#0b1a14]" : "text-white/70"
          }`}
        >
          קישור במייל
        </button>
      </div>

      {mode === "pin" ? (
        <form onSubmit={submitPin} className="space-y-3">
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="טלפון או מייל"
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder:text-white/40 focus:border-white/50 outline-none"
          />
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="PIN"
            inputMode="numeric"
            maxLength={6}
            dir="ltr"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder:text-white/40 focus:border-white/50 outline-none text-center text-2xl tracking-widest tnum"
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-500 text-[#062017] font-bold disabled:opacity-60"
          >
            {busy ? "מתחבר..." : "התחבר"}
          </button>
        </form>
      ) : sentEmail ? (
        <div className="rounded-xl border border-white/10 p-5 text-sm text-white/80 space-y-2">
          <p className="font-medium">בדוק/י את המייל שלך</p>
          <p className="text-white/60">
            שלחנו קישור התחברות שתקף ל-15 דקות. לחיצה על הקישור תכניס אותך אוטומטית.
          </p>
          <button
            type="button"
            onClick={() => setSentEmail(false)}
            className="text-emerald-400 underline"
          >
            שלחו שוב
          </button>
        </div>
      ) : (
        <form onSubmit={submitMagic} className="space-y-3">
          <input
            value={magicEmail}
            onChange={(e) => setMagicEmail(e.target.value)}
            placeholder="המייל שרשום במערכת"
            dir="ltr"
            type="email"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white placeholder:text-white/40 focus:border-white/50 outline-none"
          />
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-500 text-[#062017] font-bold disabled:opacity-60"
          >
            {busy ? "שולח..." : "שלח קישור"}
          </button>
        </form>
      )}
    </div>
  );
}
