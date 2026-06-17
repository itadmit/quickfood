"use client";

import { useState } from "react";
import { IcoCreditCard, IcoCheck } from "@/components/shared/Icons";

interface Props {
  prefill: { businessName: string; businessNumber: string; phone: string; website: string };
}

const FIELD_CLS =
  "w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-sm text-black placeholder-black/40 outline-none focus:shadow-[0_2px_0_#000] transition";
const LABEL_CLS = "block text-sm font-black text-black mb-1.5";

export function ConnectPaymentForm({ prefill }: Props) {
  const [businessName, setBusinessName] = useState(prefill.businessName);
  const [businessNumber, setBusinessNumber] = useState(prefill.businessNumber);
  const [phone, setPhone] = useState(prefill.phone);
  const [website, setWebsite] = useState(prefill.website);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/v1/grow-signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessName, businessNumber, phone, website }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? "שליחה נכשלה");
      }
      setStatus("done");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "שליחה נכשלה");
    }
  }

  if (status === "done") {
    return (
      <div className="w-full max-w-md rounded-3xl border-2 border-black bg-white shadow-[0_4px_0_#000] p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F8CB1E] border-2 border-black grid place-items-center mb-4">
          <IcoCheck c="#000" s={26} />
        </div>
        <h1 className="text-xl font-black text-black mb-2">הפרטים נשלחו!</h1>
        <p className="text-sm text-black/70 leading-relaxed">
          Grow יצרו איתכם קשר וישלחו את כל הטפסים לחתימה דיגיטלית. בלי ניירת ובלי
          התרוצצויות.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-3xl border-2 border-black bg-white shadow-[0_4px_0_#000] overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 py-5 border-b-2 border-black bg-[#F8CB1E]">
        <div className="w-10 h-10 rounded-xl bg-black grid place-items-center shrink-0">
          <IcoCreditCard c="#F8CB1E" s={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-black text-base text-black">חיבור סליקה</div>
          <div className="text-[11px] text-black/60">קבלת תשלומים באשראי, Bit ו-Apple Pay</div>
        </div>
        <a href="/" aria-label="QuickFood" className="shrink-0">
          <img src="/quickfood-mark-white.png" alt="QuickFood" width={96} height={24} className="h-6 w-auto" />
        </a>
      </div>

      <div className="p-6 space-y-4">
        <p className="text-sm text-black/75 leading-relaxed">
          משאירים פרטים קצרים, ו-Grow פותחים לכם תיק סליקה ושולחים את הטפסים לחתימה
          דיגיטלית.
        </p>

        <div>
          <label className={LABEL_CLS} htmlFor="businessName">
            שם העסק
          </label>
          <input
            id="businessName"
            className={FIELD_CLS}
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="הפיצרייה של דני"
            required
          />
        </div>

        <div>
          <label className={LABEL_CLS} htmlFor="businessNumber">
            מספר עוסק / ת.ז
          </label>
          <input
            id="businessNumber"
            className={FIELD_CLS}
            value={businessNumber}
            onChange={(e) => setBusinessNumber(e.target.value)}
            inputMode="numeric"
            placeholder="123456789"
            required
          />
        </div>

        <div>
          <label className={LABEL_CLS} htmlFor="phone">
            טלפון נייד
          </label>
          <input
            id="phone"
            className={FIELD_CLS}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="0501234567"
            pattern="05\d{8}"
            required
          />
          <p className="text-[11px] text-black/45 mt-1">
            חשוב: הזינו מספר נייד - Grow ישלחו אליו SMS עם לינק להשלמת ההרשמה.
          </p>
        </div>

        <div>
          <label className={LABEL_CLS} htmlFor="website">
            לינק לאתר
          </label>
          <input
            id="website"
            className={FIELD_CLS}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="example.co.il"
            required
          />
        </div>

        {error ? (
          <div className="rounded-xl border-2 border-black bg-[#FFE2E2] px-4 py-3 text-sm font-bold text-black">
            {error}
          </div>
        ) : null}
      </div>

      <div className="px-6 pb-6">
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-black text-[#F8CB1E] font-black text-sm border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-none transition disabled:opacity-60"
        >
          {status === "sending" ? "שולח..." : "שליחת פרטים"}
        </button>
      </div>
    </form>
  );
}
