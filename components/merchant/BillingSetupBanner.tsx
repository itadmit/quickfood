"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IcoCreditCard, IcoArrowLeft, IcoInfo } from "@/components/shared/Icons";

export function BillingSetupBanner({
  hasPaymentMethod,
  trialDaysLeft,
  trialExpired,
}: {
  hasPaymentMethod: boolean;
  trialDaysLeft: number | null;
  trialExpired: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [tipOpen, setTipOpen] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tipOpen) return;
    function onDoc(e: MouseEvent) {
      if (tipRef.current && !tipRef.current.contains(e.target as Node)) {
        setTipOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [tipOpen]);

  if (hasPaymentMethod) return null;
  if (pathname.startsWith("/dashboard/billing")) return null;
  if (trialExpired) return null;

  const urgent = trialDaysLeft !== null && trialDaysLeft <= 2;
  const headline =
    trialDaysLeft === null
      ? "החשבון טרם הופעל"
      : trialDaysLeft === 0
        ? "תקופת הניסיון מסתיימת היום"
        : trialDaysLeft === 1
          ? "תקופת הניסיון מסתיימת מחר"
          : `נותרו ${trialDaysLeft} ימים בניסיון`;
  const tooltipBody =
    "כדי לפתוח את כל האפשרויות המלאות במערכת יש להזין כרטיס אשראי ולהסדיר תשלום. שימו לב - לא תחויבו עדיין.";

  return (
    <div
      className={
        urgent
          ? "qf-billing-banner qf-billing-banner-urgent bg-qf-tomato-soft border-b border-qf-tomato/40"
          : "qf-billing-banner bg-qf-yolk-soft border-b border-qf-yolk/40"
      }
    >
      <div className="px-3 lg:px-6 py-1.5 flex items-center gap-2 text-sm text-qf-ink">
        <div
          className={
            urgent
              ? "qf-billing-icon w-5 h-5 rounded-full bg-qf-tomato/20 grid place-items-center shrink-0"
              : "qf-billing-icon w-5 h-5 rounded-full bg-qf-yolk/30 grid place-items-center shrink-0"
          }
        >
          <IcoCreditCard c={urgent ? "#c2421f" : "var(--qf-deep)"} s={11} />
        </div>
        <span className="font-medium truncate">{headline}</span>

        <div ref={tipRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setTipOpen((v) => !v)}
            onMouseEnter={() => setTipOpen(true)}
            aria-label="מידע נוסף"
            aria-expanded={tipOpen}
            className="w-5 h-5 rounded-full grid place-items-center text-qf-ink2 hover:text-qf-ink hover:bg-black/5 transition"
          >
            <IcoInfo c="currentColor" s={14} />
          </button>
          {tipOpen && (
            <div
              role="tooltip"
              onMouseLeave={() => setTipOpen(false)}
              className="absolute z-50 top-full mt-1.5 inset-inline-start-0 w-64 bg-white border border-qf-line-dash rounded-xl shadow-lg p-3 text-xs text-qf-ink leading-relaxed"
            >
              {tooltipBody}
            </div>
          )}
        </div>

        <Link
          href="/dashboard/billing"
          className="qf-billing-cta ms-auto inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-[#F8CB1E] hover:bg-[#FFD843] text-black border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] text-xs font-bold transition-all"
        >
          הזן אשראי
          <IcoArrowLeft c="currentColor" s={12} />
        </Link>
      </div>
    </div>
  );
}
