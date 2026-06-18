"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/cn";

/**
 * Final signup step as a floating modal: the merchant fills name/phone/email/
 * password on step 3, hits "פתיחת חנות", and this pops to verify the mobile via
 * SMS-OTP. On a correct code it hands the parent the phone_verify_token and the
 * parent creates the store (onVerified runs the actual signup submit).
 */
export function SignupOtpModal({
  phone,
  onVerified,
  onClose,
}: {
  phone: string;
  /** Runs the real signup submit. Resolves when done (success navigates away). */
  onVerified: (token: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const sentOnceRef = useRef(false);

  async function sendCode() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/signup-otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error?.message ?? "שליחת הקוד נכשלה");
        return;
      }
      setCooldown(typeof d.retry_in === "number" ? d.retry_in : 60);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
    } finally {
      setSending(false);
    }
  }

  // Auto-send the code the moment the modal opens (guard the dev double-mount).
  useEffect(() => {
    if (sentOnceRef.current) return;
    sentOnceRef.current = true;
    void sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verifyCode() {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/signup-otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const d = await res.json();
      if (!res.ok || !d.token) {
        setError(d.error?.message ?? "הקוד שגוי או שפג תוקפו");
        setVerifying(false);
        return;
      }
      // Correct code - hand off to the parent to open the store. Keep the
      // modal in a "finishing" state; on success the parent navigates away.
      setVerifying(false);
      setFinishing(true);
      await onVerified(d.token);
    } catch {
      setError("שגיאת רשת. נסו שוב.");
      setVerifying(false);
      setFinishing(false);
    }
  }

  const busy = verifying || finishing;

  return (
    <Modal open onClose={onClose} closeOnBackdrop={!busy} size="sm" ariaLabel="אימות מספר נייד">
      <header className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-qf-line">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-[#F8CB1E] grid place-items-center shrink-0 border-2 border-black">
            <MessageSquare size={18} className="text-black" />
          </span>
          <div className="min-w-0">
            <h3 className="font-black text-lg leading-tight">אימות מספר נייד</h3>
            <p className="text-xs text-qf-mute">צעד אחרון לפתיחת החנות</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="shrink-0 text-qf-mute hover:text-qf-ink text-2xl leading-none disabled:opacity-50"
          aria-label="סגירה"
        >
          ×
        </button>
      </header>

      <div className="px-5 py-4 space-y-3">
        <p className="text-sm text-black/70 leading-relaxed">
          שלחנו קוד בן 6 ספרות אל <span dir="ltr" className="font-bold">{phone}</span>. הזינו אותו כדי לסיים:
        </p>

        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="------"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && code.length >= 4 && !busy) verifyCode();
          }}
          className="w-full px-3.5 py-3.5 rounded-xl border-2 border-black bg-[#FFFBEC] focus:bg-white focus:shadow-[0_0_0_3px_#F8CB1E] outline-none transition font-mono font-bold text-black text-2xl text-center tracking-[0.5em] placeholder:tracking-normal placeholder:text-black/20 disabled:opacity-60"
        />

        {error && (
          <p className="text-xs font-bold text-qf-tomato inline-flex items-center gap-1">
            <X size={13} strokeWidth={2.6} />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={sendCode}
          disabled={cooldown > 0 || sending || busy}
          className="text-xs font-bold text-black/65 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending
            ? "שולח…"
            : cooldown > 0
              ? `שליחה חוזרת בעוד ${cooldown} שניות`
              : "לא קיבלתי קוד · שליחה חוזרת"}
        </button>
      </div>

      <footer className="px-5 pb-5 pt-1">
        <button
          type="button"
          onClick={verifyCode}
          disabled={code.length < 4 || busy}
          className={cn(
            "w-full px-5 py-3 rounded-xl bg-[#F8CB1E] hover:bg-[#ffd84a] text-black text-base font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2",
          )}
        >
          {finishing ? (
            <>
              <span className="qf-spinner" aria-hidden />
              <span>פותח חנות…</span>
            </>
          ) : verifying ? (
            "מאמת…"
          ) : (
            "אימות ופתיחת חנות"
          )}
        </button>
      </footer>
    </Modal>
  );
}
