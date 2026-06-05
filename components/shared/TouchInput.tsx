"use client";

import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { VirtualKeyboard } from "./VirtualKeyboard";

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
        <VirtualKeyboard
          value={value}
          onChange={onChange}
          onClose={() => setKbdOpen(false)}
          placeholder={placeholder}
          maxLength={maxLength}
        />
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
        <VirtualKeyboard
          value={value}
          onChange={onChange}
          onClose={() => setKbdOpen(false)}
          placeholder={placeholder}
          maxLength={maxLength}
        />
      )}
    </>
  );
}
