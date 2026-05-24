"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IcoArrowLeft } from "@/components/shared/Icons";

/**
 * First-login welcome overlay for new merchants. Full-screen, branded
 * with the landing-page yellow (#F8CB1E) + bold black energy to feel
 * like a continuation of the marketing site rather than an HR form.
 *
 * Two big choices, plus a quiet "later" escape. Every choice dismisses
 * via PATCH /api/v1/merchant/tenant so the overlay never appears again
 * (`tenant.onboardingDismissedAt` gets stamped server-side). Mount in
 * the dashboard layout — see app/(merchant)/dashboard/layout.tsx.
 */
export function OnboardingWelcome({ merchantName }: { merchantName: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"scratch" | "wolt" | "later" | null>(null);

  async function dismissAndGo(target: "scratch" | "wolt" | "later") {
    setBusy(target);
    // Fire-and-forget the dismiss — we don't block navigation on a
    // network call. If it fails (network drop) the overlay will reappear
    // once on the next dashboard load, which is the right safe default.
    fetch("/api/v1/merchant/tenant", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ onboarding_dismissed: true }),
    }).catch(() => {});

    if (target === "scratch") router.push("/dashboard/menu");
    else if (target === "wolt") router.push("/dashboard/settings/advanced");
    else router.refresh();
  }

  const firstName = merchantName?.split(" ")[0] ?? "";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ backgroundColor: "#F8CB1E" }}
      role="dialog"
      aria-modal="true"
      aria-label="ברוך הבא ל-QuickFood"
    >
      {/* Subtle dot pattern echo of the landing-page hero — keeps the
          surface from feeling like a slab of color. */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #000 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden
      />

      <div className="relative min-h-screen flex flex-col items-center justify-center px-5 py-10">
        {/* Brand chip — same energy as the landing-page logo lockup */}
        <div className="mb-8 inline-flex items-center gap-2 text-black/70 text-sm font-semibold">
          <span className="bg-black text-[#F8CB1E] px-2.5 py-1 rounded-md text-xs font-black tracking-wide">
            QuickFood
          </span>
          <span>ברוכים הבאים</span>
        </div>

        <h1 className="text-black font-black text-center text-4xl md:text-5xl lg:text-6xl leading-[1.05] mb-4 max-w-3xl">
          {firstName ? `היי ${firstName},` : "היי,"}
          <br />
          <span className="bg-black text-[#F8CB1E] px-3 py-0.5 rounded-lg inline-block mt-2">
            איך נתחיל?
          </span>
        </h1>

        <p className="text-black/70 text-center text-base md:text-lg mb-10 md:mb-12 max-w-xl">
          שתי דרכים להעלות את החנות שלך לאוויר. בחר את מה שעובד לך —
          תמיד אפשר להמשיך בדרך השנייה אחר כך.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 w-full max-w-4xl">
          <Tile
            variant="primary"
            badge="חדש פה"
            title="להתחיל מאפס"
            body="בנה תפריט מאפס עם העורך שלנו — קטגוריות, פריטים, גדלים ותוספות. מומלץ אם זו החנות אונליין הראשונה שלך."
            cta="נתחיל לבנות"
            onClick={() => dismissAndGo("scratch")}
            busy={busy === "scratch"}
            disabled={busy !== null && busy !== "scratch"}
          />

          <Tile
            variant="dark"
            badge="כבר ב-Wolt"
            title="לייבא תפריט מ-Wolt"
            body="מדביקים כתובת חנות, ואנחנו מייבאים אוטומטית את הקטגוריות, הפריטים, התמונות והתוספות. חוסך שעות."
            cta="לייבוא"
            onClick={() => dismissAndGo("wolt")}
            busy={busy === "wolt"}
            disabled={busy !== null && busy !== "wolt"}
          />
        </div>

        <button
          type="button"
          onClick={() => dismissAndGo("later")}
          disabled={busy !== null}
          className="mt-8 md:mt-10 text-black/60 hover:text-black text-sm font-medium underline underline-offset-4 disabled:opacity-50"
        >
          {busy === "later" ? "סוגר..." : "אחר כך, קודם תני לי לסייר"}
        </button>
      </div>
    </div>
  );
}

function Tile({
  variant,
  badge,
  title,
  body,
  cta,
  onClick,
  busy,
  disabled,
}: {
  variant: "primary" | "dark";
  badge: string;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  const primary = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "group relative text-right rounded-3xl p-6 md:p-8 flex flex-col gap-4 transition shadow-[0_4px_0_#000] hover:shadow-[0_8px_0_#000] hover:-translate-y-1 active:translate-y-0 active:shadow-[0_2px_0_#000] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[0_4px_0_#000] " +
        (primary
          ? "bg-white text-black border-4 border-black"
          : "bg-black text-white border-4 border-black")
      }
    >
      <span
        className={
          "inline-flex self-start px-2.5 py-1 rounded-md text-xs font-black tracking-wide " +
          (primary
            ? "bg-black text-[#F8CB1E]"
            : "bg-[#F8CB1E] text-black")
        }
      >
        {badge}
      </span>

      <div className="flex-1 flex flex-col gap-2">
        <h3 className="text-2xl md:text-3xl font-black leading-tight">
          {title}
        </h3>
        <p
          className={
            "text-sm md:text-base leading-relaxed " +
            (primary ? "text-black/70" : "text-white/75")
          }
        >
          {body}
        </p>
      </div>

      <div
        className={
          "flex items-center gap-2 font-bold text-base mt-2 " +
          (primary ? "text-black" : "text-[#F8CB1E]")
        }
      >
        <span>{busy ? "טוען..." : cta}</span>
        <span
          className={
            "transition-transform group-hover:-translate-x-1 " +
            (primary ? "" : "text-[#F8CB1E]")
          }
        >
          <IcoArrowLeft c="currentColor" s={20} />
        </span>
      </div>
    </button>
  );
}
