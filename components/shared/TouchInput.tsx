"use client";

import { useEffect, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { VirtualKeyboard } from "./VirtualKeyboard";

/**
 * Portal the keyboard to document.body so `position: fixed` is anchored
 * to the viewport, not whatever transformed/filtered modal ancestor
 * happens to be wrapping the input. The walk-in / discount / tip modals
 * all use `animate-qf-check-in` which sets `transform: scale(...)` -
 * that creates a containing block, so a plain inline render of the
 * keyboard would float in the middle of the modal card instead of
 * spanning the full screen width at the bottom.
 */
function KeyboardPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

type BaseProps = {
  value: string;
  onChange: (next: string) => void;
};

type TouchInputProps = BaseProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">;

export function TouchInput({
  value,
  onChange,
  onFocus,
  onClick,
  placeholder,
  maxLength,
  ...rest
}: TouchInputProps) {
  const [kbdOpen, setKbdOpen] = useState(false);
  return (
    <>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setKbdOpen(true);
          onFocus?.(e);
        }}
        onClick={(e) => {
          setKbdOpen(true);
          onClick?.(e);
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode="none"
      />
      {kbdOpen && (
        <KeyboardPortal>
          <VirtualKeyboard
            value={value}
            onChange={onChange}
            onClose={() => setKbdOpen(false)}
            placeholder={placeholder}
            maxLength={maxLength}
          />
        </KeyboardPortal>
      )}
    </>
  );
}

type TouchTextareaProps = BaseProps &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">;

export function TouchTextarea({
  value,
  onChange,
  onFocus,
  onClick,
  placeholder,
  maxLength,
  ...rest
}: TouchTextareaProps) {
  const [kbdOpen, setKbdOpen] = useState(false);
  return (
    <>
      <textarea
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          setKbdOpen(true);
          onFocus?.(e);
        }}
        onClick={(e) => {
          setKbdOpen(true);
          onClick?.(e);
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode="none"
      />
      {kbdOpen && (
        <KeyboardPortal>
          <VirtualKeyboard
            value={value}
            onChange={onChange}
            onClose={() => setKbdOpen(false)}
            placeholder={placeholder}
            maxLength={maxLength}
          />
        </KeyboardPortal>
      )}
    </>
  );
}
