"use client";

import { useState, useId, type FormEvent } from "react";
import { IcoCheck, IcoArrowLeft } from "@/components/shared/Icons";

interface Props {
  source: string;
  heading?: string;
  subheading?: string;
  submitLabel?: string;
  className?: string;
}

interface FormState {
  name: string;
  restaurant: string;
  phone: string;
  email: string;
  message: string;
  website: string;
}

const EMPTY: FormState = {
  name: "",
  restaurant: "",
  phone: "",
  email: "",
  message: "",
  website: "",
};

export function LeadForm({
  source,
  heading = "נדבר?",
  subheading = "השאר פרטים ונחזור אליך תוך יום עבודה. בלי שיחת מכירה אגרסיבית — שאלות, הדגמה, וזהו.",
  submitLabel = "שלחו לי פרטים",
  className = "",
}: Props) {
  const uid = useId();
  const [data, setData] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, source }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !body.ok) {
        throw new Error(body.error?.message ?? "שגיאה בשליחה");
      }
      setStatus("ok");
    } catch (err) {
      setStatus("err");
      setError(err instanceof Error ? err.message : "שגיאה בשליחה");
    }
  }

  if (status === "ok") {
    return (
      <div
        className={`bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-8 lg:p-10 text-center ${className}`}
        dir="rtl"
      >
        <div className="mx-auto w-14 h-14 rounded-full bg-black grid place-items-center mb-4">
          <IcoCheck c="#F8CB1E" s={28} />
        </div>
        <div className="text-2xl font-black text-black mb-2">קיבלנו!</div>
        <div className="text-base text-black/70 leading-relaxed max-w-md mx-auto">
          תודה {data.name.split(" ")[0]}. נחזור אליך תוך יום עבודה למייל{" "}
          <span dir="ltr" className="font-black">{data.email}</span>
          {data.phone ? " או לטלפון." : "."}
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      dir="rtl"
      className={`bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-6 lg:p-8 ${className}`}
      noValidate
    >
      {(heading || subheading) && (
        <header className="mb-5">
          {heading && (
            <div className="text-2xl lg:text-3xl font-black text-black tracking-tight leading-tight">
              {heading}
            </div>
          )}
          {subheading && (
            <div className="text-sm lg:text-base text-black/65 leading-relaxed mt-2">
              {subheading}
            </div>
          )}
        </header>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
        <Field id={`${uid}-name`} label="שם מלא" required>
          <input
            id={`${uid}-name`}
            type="text"
            value={data.name}
            onChange={(e) => update("name", e.target.value)}
            required
            autoComplete="name"
            className={inputCls}
          />
        </Field>
        <Field id={`${uid}-rest`} label="שם המסעדה">
          <input
            id={`${uid}-rest`}
            type="text"
            value={data.restaurant}
            onChange={(e) => update("restaurant", e.target.value)}
            autoComplete="organization"
            className={inputCls}
          />
        </Field>
        <Field id={`${uid}-phone`} label="טלפון">
          <input
            id={`${uid}-phone`}
            type="tel"
            value={data.phone}
            onChange={(e) => update("phone", e.target.value)}
            autoComplete="tel"
            dir="ltr"
            placeholder="050-0000000"
            className={inputCls}
          />
        </Field>
        <Field id={`${uid}-email`} label="מייל" required>
          <input
            id={`${uid}-email`}
            type="email"
            value={data.email}
            onChange={(e) => update("email", e.target.value)}
            required
            autoComplete="email"
            dir="ltr"
            placeholder="you@restaurant.co.il"
            className={inputCls}
          />
        </Field>
      </div>

      <Field id={`${uid}-msg`} label="הודעה (אופציונלי)" className="mt-3 lg:mt-4">
        <textarea
          id={`${uid}-msg`}
          value={data.message}
          onChange={(e) => update("message", e.target.value)}
          rows={3}
          placeholder="כמה סניפים? איזה סוג מטבח? משהו ספציפי שחשוב לדעת?"
          className={`${inputCls} resize-y min-h-22`}
        />
      </Field>

      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <label>
          השאר ריק
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={data.website}
            onChange={(e) => update("website", e.target.value)}
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border-2 border-red-200 text-sm text-red-900">
          {error}
        </div>
      )}

      <div className="mt-5 lg:mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex items-center justify-center gap-2 bg-black text-white text-base font-black px-6 py-3.5 rounded-full border-2 border-black shadow-[0_4px_0_#000] hover:shadow-[0_2px_0_#000] active:translate-y-1 active:shadow-[0_0_0_#000] disabled:opacity-60 disabled:cursor-not-allowed transition"
        >
          {status === "sending" ? "שולח…" : submitLabel}
          {status !== "sending" && <IcoArrowLeft c="currentColor" s={14} />}
        </button>
        <span className="text-xs text-black/55 leading-snug">
          בלחיצה אתה מאשר שאנחנו יוצרים איתך קשר. אין רשימת תפוצה ואין ספאם.
        </span>
      </div>
    </form>
  );
}

const inputCls =
  "w-full px-4 py-3 rounded-xl border-2 border-black/15 bg-white text-base text-black placeholder:text-black/35 focus:border-black focus:outline-none transition";

function Field({
  id,
  label,
  required,
  className = "",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className={`block ${className}`}>
      <span className="block text-sm font-bold text-black mb-1.5">
        {label}
        {required && <span className="text-red-600 mr-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
