"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/shared/Modal";
import { IcoCreditCard, IcoClose, IcoArrowLeft } from "@/components/shared/Icons";
import { GROW_SIGNUP_URL } from "@/lib/grow-signup";

/**
 * One-time dashboard nudge for merchants who already entered menu items but
 * have no active clearing provider: connect card payments via Grow's quick
 * signup form. Dismissal is remembered in localStorage per tenant; once Grow
 * is active the render condition in DashboardViewV2 stops mounting it anyway.
 */
export function GrowNudgeModal({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const dismissKey = `qf:grow-nudge:dismissed:${tenantId}`;

  useEffect(() => {
    if (localStorage.getItem(dismissKey)) return;
    const t = setTimeout(() => setOpen(true), 900);
    return () => clearTimeout(t);
  }, [dismissKey]);

  function dismiss() {
    localStorage.setItem(dismissKey, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <Modal open onClose={dismiss} size="md" ariaLabel="חיבור סליקה דרך Grow">
      <div className="flex flex-col" dir="rtl">
        <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-black bg-[#F8CB1E] rounded-t-3xl shrink-0">
          <div className="w-9 h-9 rounded-xl bg-black grid place-items-center shrink-0">
            <IcoCreditCard c="#F8CB1E" s={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-sm text-black">מוכנים לקבל תשלומים באשראי?</div>
            <div className="text-[11px] text-black/60">התפריט כבר באוויר - זה השלב הבא</div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 grid place-items-center transition"
            aria-label="סגור"
          >
            <IcoClose c="#000" s={14} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-black/75 leading-relaxed">
            כדי שהלקוחות יוכלו לשלם באשראי, PayBox, Bit, Apple Pay ו-Google Pay
            צריך לחבר חברת סליקה - ואנחנו ממליצים על{" "}
            <span className="font-black text-black">Grow</span>.
          </p>
          <div className="rounded-xl border-2 border-black bg-[#FFFBEC] p-4 shadow-[0_2px_0_#000]">
            <p className="text-sm font-bold text-black leading-relaxed">
              משאירים פרטים בטופס הקצר, ו-Grow ישלחו אליכם את כל הטפסים
              דיגיטלית. בלי ניירת ובלי התרוצצויות.
            </p>
          </div>
          <p className="text-xs text-black/50">
            כבר יש לכם חשבון Grow?{" "}
            <Link
              href="/dashboard/settings/payments"
              onClick={dismiss}
              className="font-bold text-black underline underline-offset-2"
            >
              חברו אותו בהגדרות התשלומים
            </Link>
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3 px-6 py-5 border-t-2 border-black/10 bg-white rounded-b-3xl">
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-2.5 rounded-xl border-2 border-black bg-white text-black font-bold text-sm hover:bg-black/5 transition"
          >
            אולי אחר כך
          </button>
          <div className="flex-1" />
          <a
            href={GROW_SIGNUP_URL}
            target="_blank"
            rel="noopener"
            onClick={dismiss}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-[#F8CB1E] font-black text-sm border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-none transition"
          >
            הרשמה מהירה ל-Grow
            <IcoArrowLeft c="currentColor" s={14} />
          </a>
        </div>
      </div>
    </Modal>
  );
}
