"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IcoArrowLeft,
  IcoArrowRight,
  IcoClose,
  IcoHome,
  IcoOrders,
  IcoMenu as IcoMenuIcon,
  IcoChart,
  IcoBike,
  IcoMegaphone,
  IcoCreditCard,
  IcoStar,
  IcoBell,
  IcoSparkle,
  IcoGear,
  IcoCheck,
} from "@/components/shared/Icons";
import { Modal } from "@/components/shared/Modal";

export const OPEN_WELCOME_EVENT = "qf:open-welcome";

type Step = 1 | 2 | 3 | 4;

export function OnboardingWelcome({
  merchantName,
  initialOpen,
}: {
  merchantName: string | null;
  initialOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState<"scratch" | "wolt" | "later" | null>(null);

  useEffect(() => {
    function onOpen() {
      setStep(1);
      setOpen(true);
    }
    window.addEventListener(OPEN_WELCOME_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_WELCOME_EVENT, onOpen);
  }, []);

  async function dismissAndGo(target: "scratch" | "wolt" | "later") {
    setBusy(target);
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

  const firstName = merchantName?.split(" ")[0] ?? "";

  return (
    <Modal
      open={open}
      onClose={() => dismissAndGo("later")}
      size="4xl"
      closeOnBackdrop={busy === null}
      ariaLabel="ברוך הבא ל-QuickFood"
      panelStyle={{ backgroundColor: "#F8CB1E" }}
      className="overflow-hidden"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #000 1.5px, transparent 1.5px)",
          backgroundSize: "26px 26px",
        }}
        aria-hidden
      />

      <button
        type="button"
        onClick={() => dismissAndGo("later")}
        disabled={busy !== null}
        aria-label="סגור"
        className="absolute top-4 inset-e-4 z-20 w-9 h-9 rounded-full bg-black/10 hover:bg-black/20 grid place-items-center text-black transition active:scale-95 disabled:opacity-50"
      >
        <IcoClose c="currentColor" s={18} />
      </button>

      <div className="relative flex-1 min-h-0 overflow-y-auto px-6 py-10 md:px-10 md:py-12 flex flex-col items-center text-center">
        {step === 1 ? (
          <div className="mb-6 inline-flex items-center gap-2 text-black/70 text-xs font-semibold">
            <span className="bg-black text-[#F8CB1E] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
              QuickFood
            </span>
            <span>ברוכים הבאים</span>
          </div>
        ) : (
          <StepPills step={step} />
        )}

        {step === 1 && (
          <Step1Welcome
            firstName={firstName}
            busy={busy}
            onScratch={() => setStep(2)}
            onWolt={() => dismissAndGo("wolt")}
          />
        )}

        {step === 2 && (
          <Step2Sidebar
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
            onSkip={() => dismissAndGo("later")}
          />
        )}

        {step === 3 && (
          <Step3Settings
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            onSkip={() => dismissAndGo("later")}
          />
        )}

        {step === 4 && (
          <Step4Ready
            busy={busy}
            onBack={() => setStep(3)}
            onScratch={() => dismissAndGo("scratch")}
            onWolt={() => dismissAndGo("wolt")}
          />
        )}
      </div>
    </Modal>
  );
}

// ─── Step pills ─────────────────────────────────────────────

function StepPills({ step }: { step: Step }) {
  const labels: Record<Step, string> = {
    1: "ברוכים הבאים",
    2: "תפריט הצד",
    3: "הגדרות",
    4: "מוכנים להתחיל",
  };
  return (
    <div className="mb-6 flex items-center gap-2">
      <span className="bg-black text-[#F8CB1E] px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide">
        QuickFood
      </span>
      <span className="text-black/70 text-xs font-semibold">
        סיור · {step} מתוך 4 · {labels[step]}
      </span>
    </div>
  );
}

// ─── Step 1: welcome + choice ───────────────────────────────

function Step1Welcome({
  firstName,
  busy,
  onScratch,
  onWolt,
}: {
  firstName: string;
  busy: "scratch" | "wolt" | "later" | null;
  onScratch: () => void;
  onWolt: () => void;
}) {
  return (
    <>
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
          cta="נתחיל סיור קצר"
          onClick={onScratch}
          busy={busy === "scratch"}
          disabled={busy !== null && busy !== "scratch"}
        />

        <Tile
          variant="dark"
          badge="כבר ב-Wolt"
          title="לייבא תפריט מ-Wolt"
          body="מדביקים כתובת חנות, ואנחנו מייבאים אוטומטית את הקטגוריות, הפריטים, התמונות והתוספות. חוסך שעות."
          cta="לייבוא"
          onClick={onWolt}
          busy={busy === "wolt"}
          disabled={busy !== null && busy !== "wolt"}
        />
      </div>
    </>
  );
}

// ─── Step 2: side menu tour ─────────────────────────────────

function Step2Sidebar({
  onBack,
  onNext,
  onSkip,
}: {
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const items: Array<{
    Icon: typeof IcoHome;
    title: string;
    body: string;
    badge?: string;
  }> = [
    {
      Icon: IcoHome,
      title: "דשבורד",
      body: "מבט-על על המכירות, ההזמנות החדשות והביקורות של היום.",
    },
    {
      Icon: IcoOrders,
      title: "הזמנות",
      body: "כל ההזמנות בזמן אמת — קבלה, הכנה, יציאה למשלוח וסגירה.",
    },
    {
      Icon: IcoMenuIcon,
      title: "תפריט",
      body: "קטגוריות, פריטים, גדלים ותוספות. עורך גרירה לסידור מהיר.",
    },
    {
      Icon: IcoChart,
      title: "אנליטיקס",
      body: "ניתוח לפי ערוץ, פריטים חמים ותובנות שיווק חכמות.",
      badge: "חדש!",
    },
    {
      Icon: IcoMegaphone,
      title: "קמפיינים",
      body: "ניהול הצעות, קופונים ושליחה ללקוחות.",
    },
    {
      Icon: IcoSparkle,
      title: "יועץ AI",
      body: "המלצות חכמות לאופטימיזציה של התפריט והמכירות.",
      badge: "חדש!",
    },
  ];

  return (
    <>
      <h2 className="text-black font-black text-2xl md:text-4xl leading-[1.05] mb-3 max-w-2xl">
        <span className="bg-black text-[#F8CB1E] px-3 py-0.5 rounded-lg inline-block">
          תפריט הצד
        </span>{" "}
        — הכל במרחק נגיעה
      </h2>

      <p className="text-black/70 text-sm md:text-base mb-7 max-w-md">
        בצד הימני יש לך גישה לכל הכלים של החנות. הנה הסקירה הקצרה.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3 w-full text-start">
        {items.map(({ Icon, title, body, badge }) => (
          <div
            key={title}
            className="flex items-start gap-3 bg-white border-2 border-black rounded-2xl p-3 md:p-3.5 shadow-[0_3px_0_#000]"
          >
            <div className="shrink-0 w-10 h-10 rounded-xl bg-[#FFF2C9] border-2 border-black grid place-items-center text-black">
              <Icon c="currentColor" s={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="font-black text-black text-sm md:text-base">
                  {title}
                </h3>
                {badge && (
                  <span className="bg-[#F8CB1E] border border-black text-black text-[10px] font-black px-1.5 py-0.5 rounded">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-black/65 text-xs md:text-[13px] leading-snug">
                {body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <NavRow onBack={onBack} onNext={onNext} onSkip={onSkip} />
    </>
  );
}

// ─── Step 3: settings tour ──────────────────────────────────

function Step3Settings({
  onBack,
  onNext,
  onSkip,
}: {
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const items: Array<{ Icon: typeof IcoGear; title: string; body: string }> = [
    {
      Icon: IcoSparkle,
      title: "מותג ועיצוב",
      body: "לוגו, צבעים, באנר ראשי וטיפוגרפיה — איך הלקוחות רואים אותך.",
    },
    {
      Icon: IcoHome,
      title: "פרטי העסק",
      body: "שם, כתובת, טלפון וח״פ. נכנס לאוטומציות ולחשבוניות.",
    },
    {
      Icon: IcoCreditCard,
      title: "תשלומים",
      body: "חיבור Grow Payments, הסדרי מזומן וקבלת תשלום בעמוד הלקוח.",
    },
    {
      Icon: IcoBell,
      title: "התראות",
      body: "SMS, WhatsApp ו-Email — ערוצי תקשורת עם הלקוח אחרי הזמנה.",
    },
    {
      Icon: IcoBike,
      title: "סניפים ומשלוחים",
      body: "אזורי משלוח, דמי משלוח, מינימום הזמנה ושעות פעילות.",
    },
    {
      Icon: IcoStar,
      title: "ביקורות",
      body: "תזמון בקשת ביקורת, תבניות לחיוב הלקוח ומענה אוטומטי.",
    },
  ];

  return (
    <>
      <h2 className="text-black font-black text-2xl md:text-4xl leading-[1.05] mb-3 max-w-2xl">
        <span className="bg-black text-[#F8CB1E] px-3 py-0.5 rounded-lg inline-block">
          הגדרות
        </span>{" "}
        — להתאים לך
      </h2>

      <p className="text-black/70 text-sm md:text-base mb-7 max-w-md">
        בהגדרות תמצא את כל מה שצריך כדי שהחנות תרגיש שלך — מהלוגו ועד
        אופן התשלום.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3 w-full text-start">
        {items.map(({ Icon, title, body }) => (
          <div
            key={title}
            className="flex items-start gap-3 bg-white border-2 border-black rounded-2xl p-3 md:p-3.5 shadow-[0_3px_0_#000]"
          >
            <div className="shrink-0 w-10 h-10 rounded-xl bg-[#FFF2C9] border-2 border-black grid place-items-center text-black">
              <Icon c="currentColor" s={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-black text-sm md:text-base mb-0.5">
                {title}
              </h3>
              <p className="text-black/65 text-xs md:text-[13px] leading-snug">
                {body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <NavRow onBack={onBack} onNext={onNext} onSkip={onSkip} />
    </>
  );
}

// ─── Step 4: ready to start ─────────────────────────────────

function Step4Ready({
  busy,
  onBack,
  onScratch,
  onWolt,
}: {
  busy: "scratch" | "wolt" | "later" | null;
  onBack: () => void;
  onScratch: () => void;
  onWolt: () => void;
}) {
  return (
    <>
      <div className="mb-4 w-14 h-14 rounded-2xl bg-black grid place-items-center shadow-[0_3px_0_#000] border-2 border-black">
        <IcoCheck c="#F8CB1E" s={28} />
      </div>

      <h2 className="text-black font-black text-2xl md:text-4xl leading-[1.05] mb-3 max-w-2xl">
        <span className="bg-black text-[#F8CB1E] px-3 py-0.5 rounded-lg inline-block">
          מוכנים?
        </span>{" "}
        בוא נתחיל
      </h2>

      <p className="text-black/70 text-sm md:text-base mb-8 max-w-md">
        ראית את עיקרי המערכת. הצעד הבא — להעלות את התפריט. בחר את הדרך
        שעובדת לך:
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full">
        <Tile
          variant="primary"
          badge="חדש פה"
          title="להתחיל מאפס"
          body="בנה תפריט מאפס עם העורך שלנו — קטגוריות, פריטים, גדלים ותוספות."
          cta="נתחיל לבנות"
          onClick={onScratch}
          busy={busy === "scratch"}
          disabled={busy !== null && busy !== "scratch"}
        />

        <Tile
          variant="dark"
          badge="כבר ב-Wolt"
          title="לייבא תפריט מ-Wolt"
          body="מדביקים כתובת חנות, ואנחנו מייבאים אוטומטית את הקטגוריות, הפריטים והתמונות."
          cta="לייבוא"
          onClick={onWolt}
          busy={busy === "wolt"}
          disabled={busy !== null && busy !== "wolt"}
        />
      </div>

      <button
        type="button"
        onClick={onBack}
        disabled={busy !== null}
        className="mt-6 text-black/70 hover:text-black text-xs md:text-sm font-bold underline underline-offset-4 inline-flex items-center gap-1.5 disabled:opacity-50"
      >
        <IcoArrowRight c="currentColor" s={14} />
        חזרה לסיור
      </button>
    </>
  );
}

// ─── Shared: nav row for tour steps ─────────────────────────

function NavRow({
  onBack,
  onNext,
  onSkip,
}: {
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3 w-full">
      <button
        type="button"
        onClick={onBack}
        className="text-black/65 hover:text-black text-sm font-bold inline-flex items-center gap-1.5"
      >
        <IcoArrowRight c="currentColor" s={14} />
        חזרה
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="text-black/55 hover:text-black text-xs font-bold underline underline-offset-4"
      >
        דלג על הסיור
      </button>

      <button
        type="button"
        onClick={onNext}
        className="px-5 py-3 rounded-xl bg-black hover:bg-black/90 text-[#F8CB1E] text-base font-black border-2 border-black shadow-[0_3px_0_#000] hover:shadow-[0_4px_0_#000] active:translate-y-px active:shadow-[0_2px_0_#000] transition inline-flex items-center gap-2"
      >
        המשך
        <IcoArrowLeft c="currentColor" s={16} />
      </button>
    </div>
  );
}

// ─── Tile (reused on step 1 + step 4) ────────────────────────

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
