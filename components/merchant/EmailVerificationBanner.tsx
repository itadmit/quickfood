"use client";

import { useState, useEffect, useRef } from "react";
import { Mail } from "lucide-react";
import { IcoClose } from "@/components/shared/Icons";

export function EmailVerificationBanner({
  emailVerifiedAt,
  email: initialEmail,
}: {
  emailVerifiedAt: string | null;
  email: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [phase, setPhase] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showChange, setShowChange] = useState(false);

  if (emailVerifiedAt) return null;

  async function resend() {
    if (phase === "sending" || phase === "sent") return;
    setPhase("sending");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/auth/verify-email/request", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setPhase("error");
        setErrorMsg(json?.error?.message ?? "השליחה נכשלה. נסה שוב.");
        return;
      }
      setPhase("sent");
    } catch {
      setPhase("error");
      setErrorMsg("השליחה נכשלה. נסה שוב.");
    }
  }

  function handleEmailChanged(newEmail: string) {
    setEmail(newEmail);
    setPhase("sent");
    setShowChange(false);
  }

  return (
    <>
      <div className="qf-billing-banner bg-qf-yolk-soft border-b border-qf-yolk/40">
        <div className="px-6 py-2.5 flex items-center gap-3 text-sm text-qf-ink">
          <div className="qf-billing-icon w-7 h-7 rounded-full bg-qf-yolk/30 grid place-items-center shrink-0">
            <Mail size={14} color="var(--qf-deep)" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-medium">צריך לאמת את כתובת המייל.</span>{" "}
            <span className="text-qf-ink2">
              שלחנו אליך מייל ל-<span dir="ltr" className="font-mono">{email}</span> עם כפתור הפעלה. לא הגיע? אפשר לשלוח שוב או להחליף כתובת.
            </span>
            {phase === "error" && errorMsg && (
              <span className="block text-xs text-qf-tomato mt-0.5">{errorMsg}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowChange(true)}
              className="qf-billing-cta-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-qf-ink/20 hover:bg-white text-qf-ink text-xs font-medium"
            >
              שנה כתובת
            </button>
            {phase === "sent" ? (
              <span className="qf-billing-cta inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-qf-green-soft text-qf-green-deep text-xs font-medium">
                נשלח! בדוק את תיבת המייל
              </span>
            ) : (
              <button
                type="button"
                onClick={resend}
                disabled={phase === "sending"}
                className="qf-billing-cta inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-xs font-medium disabled:opacity-60"
              >
                {phase === "sending" ? "שולח..." : "שלח לי שוב"}
              </button>
            )}
          </div>
        </div>
      </div>

      {showChange && (
        <ChangeEmailModal
          currentEmail={email}
          onClose={() => setShowChange(false)}
          onSaved={handleEmailChanged}
        />
      )}
    </>
  );
}

function ChangeEmailModal({
  currentEmail,
  onClose,
  onSaved,
}: {
  currentEmail: string;
  onClose: () => void;
  onSaved: (newEmail: string) => void;
}) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "saving") return;
    const next = value.trim().toLowerCase();
    if (!next || next === currentEmail.toLowerCase()) {
      setPhase("error");
      setErrorMsg("הזן כתובת חדשה ושונה מהנוכחית.");
      return;
    }
    setPhase("saving");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/auth/verify-email/change-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPhase("error");
        setErrorMsg(json?.error?.message ?? "השמירה נכשלה. נסה שוב.");
        return;
      }
      onSaved(json.email as string);
    } catch {
      setPhase("error");
      setErrorMsg("השמירה נכשלה. נסה שוב.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[80] grid place-items-center bg-black/55 backdrop-blur-sm p-4 animate-qf-modal-in"
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden border-2 border-black"
        style={{
          backgroundColor: "#FFFBEC",
          boxShadow: "6px 6px 0 0 #000",
          transform: "translate3d(0,0,0)",
        }}
      >
        {/* Yellow header strip with the praying-hands badge centered in it,
            mirroring the V2 brand palette used across the dashboard auth
            screens. */}
        <div
          className="relative px-6 pt-6 pb-8"
          style={{
            backgroundColor: "#F8CB1E",
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="absolute top-3 inset-s-3 w-9 h-9 rounded-full grid place-items-center bg-white border-2 border-black hover:bg-[#FFFBEC] transition"
            style={{ boxShadow: "2px 2px 0 0 #000" }}
          >
            <IcoClose s={14} c="#000" />
          </button>

          <div
            className="mx-auto w-16 h-16 rounded-full bg-white border-2 border-black grid place-items-center text-3xl leading-none"
            style={{ boxShadow: "3px 3px 0 0 #000" }}
            aria-hidden
          >
            🙏
          </div>
        </div>

        <div className="px-6 pt-5 pb-1 text-center">
          <h2 className="text-[19px] font-black leading-snug text-black">
            סמכנו עלייך, לא נורא — יאללה עכשיו שאנחנו מכירים, הזן את המייל האמיתי בבקשה.
          </h2>
          <p className="text-xs text-black/65 mt-2 leading-relaxed">
            נשלח לכתובת החדשה מייל אימות חדש. הקישור הישן יפסיק לעבוד.
          </p>
        </div>

        <form onSubmit={submit} className="px-6 pt-4 pb-6 space-y-3.5">
          <div>
            <label className="block text-xs font-black text-black mb-1.5">
              כתובת המייל שהזנת <span className="text-black/55">"בטעות"</span>{" "}
              <span aria-hidden>😉</span>
            </label>
            <div
              dir="ltr"
              className="text-sm font-mono text-black/55 px-3.5 py-3 rounded-xl border-2 border-dashed border-black/30 bg-black/[0.04] line-through decoration-black/40"
            >
              {currentEmail}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-black mb-1.5">
              כתובת מייל חדשה (האמיתית הפעם)
            </label>
            <input
              ref={inputRef}
              type="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              dir="ltr"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full px-3.5 py-3 rounded-xl border-2 border-black bg-white hover:bg-[#FFFBEC] focus:bg-white focus:border-black focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-mono font-semibold text-black placeholder:text-black/35"
            />
          </div>

          {phase === "error" && errorMsg && (
            <div className="text-xs font-medium text-qf-tomato bg-qf-tomato-soft border-2 border-qf-tomato/30 rounded-xl px-3 py-2.5">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-white border-2 border-black text-black text-sm font-bold hover:bg-[#FFFBEC] transition"
              style={{ boxShadow: "3px 3px 0 0 #000" }}
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={phase === "saving"}
              className="flex-1 px-4 py-3 rounded-xl border-2 border-black text-black text-sm font-black transition disabled:opacity-60"
              style={{
                backgroundColor: "#F8CB1E",
                boxShadow: "3px 3px 0 0 #000",
              }}
            >
              {phase === "saving" ? "שומר..." : "שמור ושלח אימות"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
