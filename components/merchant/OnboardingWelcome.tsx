"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IcoArrowLeft, IcoClose } from "@/components/shared/Icons";

/**
 * Custom event that any place in the dashboard can dispatch to re-open
 * this overlay after the initial dismiss. The Topbar "import shortcut"
 * button uses it so a merchant who skipped the welcome on first login
 * can still reach the import flow with one tap.
 */
export const OPEN_WELCOME_EVENT = "qf:open-welcome";

/**
 * First-login welcome overlay for new merchants. Full-screen, branded
 * with the landing-page yellow (#F8CB1E) + bold black energy to feel
 * like a continuation of the marketing site rather than an HR form.
 *
 * Two big choices, plus a quiet "later" escape. Auto-opens for tenants
 * whose `onboardingDismissedAt` is NULL (controlled via `initialOpen`).
 * Subsequent opens come from the OPEN_WELCOME_EVENT — dispatched by
 * the Topbar import shortcut. Every choice/dismiss stamps the field
 * server-side via PATCH /api/v1/merchant/tenant.
 */
export function OnboardingWelcome({
  merchantName,
  initialOpen,
}: {
  merchantName: string | null;
  initialOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [busy, setBusy] = useState<"scratch" | "wolt" | "later" | null>(null);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(OPEN_WELCOME_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_WELCOME_EVENT, onOpen);
  }, []);

  // ESC closes the modal at any time. The X button does the same. We
  // used to "trap" first-time users until they picked an option, but
  // the modal style with a visible X already signals it's dismissable
  // — being heavy-handed about it would feel like a dark pattern.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismissAndGo("later");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // dismissAndGo is stable enough (uses setState + router from closure)
    // that re-binding per render is wasted; intentional empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

    setOpen(false);
    if (target === "scratch") {
      router.push("/dashboard/menu");
    } else if (target === "wolt") {
      router.push("/dashboard/settings/advanced");
    } else {
      router.refresh();
    }
  }

  if (!open) return null;

  const firstName = merchantName?.split(" ")[0] ?? "";

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="ברוך הבא ל-QuickFood"
      onClick={(e) => {
        // Click on the backdrop (not the modal itself) dismisses as "later"
        if (e.target === e.currentTarget && busy === null) dismissAndGo("later");
      }}
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: "#F8CB1E" }}
      >
        {/* Subtle dot pattern echo of the landing-page hero — keeps the
            yellow surface from feeling like a flat slab of color. */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #000 1.5px, transparent 1.5px)",
            backgroundSize: "26px 26px",
          }}
          aria-hidden
        />

        {/* Close button — top-end in RTL (visual top-left), matches
            other modals in the app (SearchPalette, ReviewPromptModal). */}
        <button
          type="button"
          onClick={() => dismissAndGo("later")}
          disabled={busy !== null}
          aria-label="סגור"
          className="absolute top-4 inset-e-4 z-10 w-9 h-9 rounded-full bg-black/10 hover:bg-black/20 grid place-items-center text-black transition active:scale-95 disabled:opacity-50"
        >
          <IcoClose c="currentColor" s={18} />
        </button>

        <div className="relative px-6 py-10 md:px-10 md:py-12 flex flex-col items-center text-center">
          {/* Brand chip — same energy as the landing-page logo lockup */}
          <div className="mb-6 inline-flex items-center gap-2 text-black/70 text-xs font-semibold">
            <span className="bg-black text-[#F8CB1E] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
              QuickFood
            </span>
            <span>ברוכים הבאים</span>
          </div>

          <h1 className="text-black font-black text-3xl md:text-5xl leading-[1.05] mb-3 max-w-2xl">
            {firstName ? `היי ${firstName},` : "היי,"}
            <br />
            <span className="bg-black text-[#F8CB1E] px-3 py-0.5 rounded-lg inline-block mt-1.5">
              איך נתחיל?
            </span>
          </h1>

          <p className="text-black/70 text-sm md:text-base mb-8 max-w-md">
            שתי דרכים להעלות את החנות שלך לאוויר. בחר את מה שעובד לך —
            תמיד אפשר להמשיך בדרך השנייה אחר כך.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full">
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
            className="mt-6 text-black/60 hover:text-black text-xs md:text-sm font-medium underline underline-offset-4 disabled:opacity-50"
          >
            {busy === "later" ? "סוגר..." : "אחר כך, קודם תני לי לסייר"}
          </button>
        </div>
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
