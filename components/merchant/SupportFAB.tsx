"use client";

import { useState } from "react";
import { IcoWhatsApp } from "@/components/shared/Icons";

const SUPPORT_PHONE = "972552554432";

function buildWhatsAppHref(merchantName: string): string {
  const name = merchantName.trim() || "סוחר";
  const message = `שלום, אני *${name}* במערכת קוויק פוד אשמח לעזרה`;
  return `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(message)}`;
}

export function SupportFAB({ merchantName }: { merchantName: string }) {
  const [hover, setHover] = useState(false);
  const href = buildWhatsAppHref(merchantName);

  return (
    <div className="fixed bottom-5 inset-s-5 z-40 flex items-center gap-2 pointer-events-none">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="פתח שיחת תמיכה בוואטסאפ"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="pointer-events-auto group flex items-center gap-2 bg-[#25D366] hover:bg-[#1FB955] active:scale-95 text-white rounded-full transition-all duration-200 px-4 h-14 border-2 border-black"
        style={{ boxShadow: "3px 3px 0 0 #000" }}
      >
        <IcoWhatsApp s={24} />
        <span
          className={
            "overflow-hidden whitespace-nowrap font-bold text-sm transition-[max-width,opacity,margin] duration-200 " +
            (hover ? "max-w-[180px] opacity-100 ms-0" : "max-w-0 opacity-0 -ms-1")
          }
        >
          צריך עזרה? כתוב לנו
        </span>
      </a>
    </div>
  );
}
