"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface BaseProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  /** Optional element rendered next to the label (e.g. "שכחת סיסמה?") */
  actionRight?: React.ReactNode;
}

export function AuthEmailField(props: BaseProps) {
  return (
    <FieldShell {...props} iconSide={<EmailIcon />}>
      <input
        id={props.id}
        type="email"
        required={props.required}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        dir="ltr"
        className="flex-1 min-w-0 bg-transparent outline-none py-3 text-sm placeholder:text-qf-mute"
      />
    </FieldShell>
  );
}

export function AuthPasswordField(props: BaseProps) {
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell
      {...props}
      iconSide={<LockIcon />}
      iconLeft={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "הסתר סיסמה" : "הצג סיסמה"}
          className="text-qf-mute hover:text-qf-ink p-1 -mx-1"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    >
      <input
        id={props.id}
        type={visible ? "text" : "password"}
        required={props.required}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        dir="ltr"
        className="flex-1 min-w-0 bg-transparent outline-none py-3 text-sm placeholder:text-qf-mute font-mono tracking-wide"
      />
    </FieldShell>
  );
}

interface ShellProps extends BaseProps {
  iconSide: React.ReactNode;
  iconLeft?: React.ReactNode;
  children: React.ReactNode;
}

function FieldShell({
  id,
  label,
  actionRight,
  iconSide,
  iconLeft,
  children,
}: ShellProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {actionRight}
      </div>
      <div
        className={cn(
          "flex items-center gap-2 bg-white border border-qf-line-dash rounded-xl px-3 transition",
          "focus-within:border-qf-ink focus-within:ring-2 focus-within:ring-qf-ink/10",
        )}
      >
        {children}
        {iconLeft && <div>{iconLeft}</div>}
        <div className="text-qf-mute shrink-0">{iconSide}</div>
      </div>
    </div>
  );
}

// ─── icons ────────────────────────────────────────────────

function EmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4.5" y="10" width="15" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="15" r="1.3" fill="currentColor" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M6 6c-2 1.7-4 6-4 6s3.5 7 10 7c2 0 3.8-.7 5.3-1.7M11 5c.3 0 .7-.1 1-.1 6.5 0 10 7 10 7s-1 2-2.7 3.7M9.5 9.5a3 3 0 014.2 4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
