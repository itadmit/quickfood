"use client";

import { IcoWhatsApp } from "@/components/shared/Icons";

function toWaNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

export function StorefrontWhatsAppFAB({ phone }: { phone: string }) {
  const number = toWaNumber(phone);
  if (!number) return null;
  const href = `https://wa.me/${number}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="דברו איתנו בוואטסאפ"
      className="fixed z-40 inset-e-4 bottom-24 lg:bottom-6 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] active:scale-95 transition-transform shadow-lg"
    >
      <IcoWhatsApp c="#fff" s={28} />
    </a>
  );
}
