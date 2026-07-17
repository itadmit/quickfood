"use client";

import { useState } from "react";
import { IcoWhatsApp } from "@/components/shared/Icons";

const SUPPORT_PHONE = "972559618968";

function buildWhatsAppHref(merchantName: string, hasNoMenuItems: boolean): string {
  const name = merchantName.trim() || "סוחר";
  const message = hasNoMenuItems
    ? `שלום, אני *${name}* במערכת קוויק פוד, צריך עזרה בהקמת האתר`
    : `שלום, אני *${name}* במערכת קוויק פוד אשמח לעזרה`;
  return `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(message)}`;
}

export function SupportFAB({
  merchantName,
  hasNoMenuItems = false,
}: {
  merchantName: string;
  hasNoMenuItems?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const href = buildWhatsAppHref(merchantName, hasNoMenuItems);
  const bubbleText = hasNoMenuItems
    ? "צריכים עזרה בהקמה? דברו איתנו פה.."
    : "יש לכם שאלה? בעיה? אנחנו פה";

  return (
    <div className="fixed bottom-5 inset-e-5 z-40 flex items-center gap-3 pointer-events-none">
      <div
        className={
          "pointer-events-none select-none origin-bottom-right rounded-2xl bg-white text-black border-2 border-black px-3 py-2 text-sm font-bold whitespace-nowrap transition-all duration-200 " +
          (hover
            ? "opacity-100 translate-x-0 scale-100"
            : "opacity-0 translate-x-2 scale-95")
        }
        style={{ boxShadow: "3px 3px 0 0 #000" }}
        aria-hidden="true"
      >
        {bubbleText}
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={bubbleText}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className="pointer-events-auto flex items-center justify-center bg-[#25D366] hover:bg-[#1FB955] active:scale-95 text-white rounded-full transition-all duration-200 w-14 h-14 border-2 border-black"
        style={{ boxShadow: "3px 3px 0 0 #000" }}
      >
        <IcoWhatsApp c="#fff" s={26} />
      </a>
    </div>
  );
}
