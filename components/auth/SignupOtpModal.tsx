"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { cn } from "@/lib/cn";

const OTP_LENGTH = 6;

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
  // Guards the auto-submit from firing twice for the same 6-digit code.
  const submittedRef = useRef<string | null>(null);

  const busy = verifying || finishing;

  async function sendCode() {
    setSending(true);
    setError(null);
    submittedRef.current = null;
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

  async function verifyCode(value?: string) {
    const c = (value ?? code).trim();
    if (c.length < OTP_LENGTH || busy) return;
    submittedRef.current = c;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/signup-otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code: c }),
      });
      const d = await res.json();
      if (!res.ok || !d.token) {
        setError(d.error?.message ?? "הקוד שגוי או שפג תוקפו");
        setVerifying(false);
        submittedRef.current = null;
        setCode("");
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
      submittedRef.current = null;
    }
  }

  // Auto-verify the instant all 6 digits are in (no need to press the button).
  function handleCodeChange(next: string) {
    setCode(next);
    if (error) setError(null);
    if (next.length === OTP_LENGTH && next !== submittedRef.current && !busy) {
      void verifyCode(next);
    }
  }

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

      <div className="px-5 py-4 space-y-4">
        <p className="text-sm text-black/70 leading-relaxed text-center">
          שלחנו קוד בן 6 ספרות אל <span dir="ltr" className="font-bold">{phone}</span>.
          <br />
          הזינו אותו כדי לסיים:
        </p>

        <OtpInput
          length={OTP_LENGTH}
          value={code}
          onChange={handleCodeChange}
          disabled={busy}
          invalid={!!error}
        />

        {error && (
          <p className="text-xs font-bold text-qf-tomato inline-flex items-center gap-1 justify-center w-full">
            <X size={13} strokeWidth={2.6} />
            {error}
          </p>
        )}

        <div className="text-center">
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
      </div>

      <footer className="px-5 pb-5 pt-1">
        <button
          type="button"
          onClick={() => verifyCode()}
          disabled={code.length < OTP_LENGTH || busy}
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

/**
 * Segmented OTP input: one box per digit with a heavy underline, RTL-safe
 * (forced LTR so digits read left→right), auto-advancing focus, backspace
 * that walks back, and full-code paste. Reports the joined value upward.
 */
function OtpInput({
  length,
  value,
  onChange,
  disabled,
  invalid,
}: {
  length: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function focusAt(i: number) {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  }

  function handleChange(i: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      const arr = value.split("");
      arr[i] = "";
      onChange(arr.join(""));
      return;
    }
    // Typed (or pasted) into this box - place from index i, advance focus.
    const merged = (value.slice(0, i) + digits).slice(0, length);
    onChange(merged);
    focusAt(merged.length >= length ? length - 1 : merged.length);
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const arr = value.split("");
      if (arr[i]) {
        arr[i] = "";
        onChange(arr.join(""));
      } else if (i > 0) {
        arr[i - 1] = "";
        onChange(arr.join(""));
        focusAt(i - 1);
      }
    }
  }

  return (
    <div dir="ltr" className="flex items-center justify-center gap-2.5">
      {Array.from({ length }).map((_, i) => {
        const filled = !!value[i];
        return (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            disabled={disabled}
            value={value[i] ?? ""}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            aria-label={`ספרה ${i + 1}`}
            className={cn(
              "w-11 h-14 rounded-xl bg-white text-center text-2xl font-semibold text-qf-ink caret-(--qf-primary) outline-none focus-visible:outline-none border transition-all duration-150",
              "focus:border-(--qf-primary) focus:shadow-[0_0_0_3px_rgba(248,203,30,0.35)]",
              disabled && "opacity-50",
              invalid
                ? "border-qf-tomato/70 focus:border-qf-tomato focus:shadow-[0_0_0_3px_rgba(194,66,31,0.18)]"
                : filled
                  ? "border-qf-ink/25"
                  : "border-qf-line",
            )}
          />
        );
      })}
    </div>
  );
}
