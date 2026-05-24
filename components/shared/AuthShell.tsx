import Link from "next/link";
import { AuthHeroVideo } from "./AuthHeroVideo";

interface Props {
  /** "login" or "signup" — controls the top-bar cross-link */
  variant: "login" | "signup";
  /** Right column content (the form) */
  children: React.ReactNode;
  /** Headline above the form (e.g. "ברוך השב.") */
  title: string;
  /** Subtitle below the headline */
  subtitle: string;
  /**
   * Kept for backwards compatibility with old callers; the brand panel is
   * a single yellow hero now, not a tilted dashboard preview.
   */
  illustration?: "kanban" | "menu";
}

/**
 * Auth screens shell — login, signup, forgot-password, reset-password
 * all wear this. Visual language is identical to the landing page:
 * cream backdrop + dot pattern, yellow/black brand chip, Pacifico
 * accent on "Quick Food", and a white form card with a 2px black
 * border + hard offset shadow.
 *
 * Layout is a 2-column grid on desktop (hero panel + form panel) that
 * collapses to a single column on mobile with the brand chip pinned in
 * the topbar instead of the full hero.
 */
export function AuthShell({ variant, children, title, subtitle }: Props) {
  return (
    // dash-v2 hooks the auth screens into the same token override the
    // V2 dashboard uses — green → yellow, surfaces → cream, ink/lines
    // → black. SignupForm's many inline qf-* utilities pick up the V2
    // palette for free, without rewriting each input.
    <div
      className="dash-v2 min-h-screen text-black"
      style={{
        backgroundColor: "#FFFBEC",
        backgroundImage:
          "radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* ─── Top bar — brand chip + cross-link to the other auth screen ─── */}
      <header className="px-5 lg:px-10 pt-6 flex items-center justify-between gap-4">
        <BrandChip />
        <Link
          href={variant === "login" ? "/signup" : "/dashboard/login"}
          className="inline-flex items-center gap-2 text-sm font-bold text-black/70 hover:text-black bg-white px-4 py-2 rounded-full border-2 border-black shadow-[0_2px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] transition"
        >
          <span className="hidden sm:inline">
            {variant === "login" ? "עוד אין חשבון?" : "כבר יש לי חשבון?"}
          </span>
          <span className="font-black text-black">
            {variant === "login" ? "הירשם בחינם ←" : "התחברות ←"}
          </span>
        </Link>
      </header>

      <div className="px-5 lg:px-10 py-8 lg:py-14">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-stretch">
          {/* ─── Hero panel (desktop only) ─── */}
          <HeroPanel />

          {/* ─── Form panel ─── */}
          <main className="flex">
            <div className="w-full max-w-md mx-auto lg:mx-0 lg:me-0 lg:ms-auto self-center">
              <div className="bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-7 lg:p-9 space-y-7">
                <div className="space-y-2">
                  <h1 className="text-3xl lg:text-4xl font-black tracking-tight leading-tight">
                    {title}
                  </h1>
                  <p className="text-sm text-black/60 leading-relaxed">
                    {subtitle}
                  </p>
                </div>
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * Black tile + cream "F" — same lockup as the landing-page top bar so
 * the merchant lands in a place that visually feels like "the same
 * product I just signed up for on the marketing site".
 */
function BrandChip() {
  return (
    <Link href="/" className="flex items-center gap-3 group min-w-0">
      <span
        className="w-10 h-10 rounded-xl bg-black grid place-items-center text-[#F8CB1E] text-lg font-black border-2 border-black shadow-[0_3px_0_#000] group-active:translate-y-px group-active:shadow-[0_2px_0_#000] transition"
        aria-hidden
      >
        F
      </span>
      <span className="flex flex-col leading-tight min-w-0">
        <span
          className="font-pacifico text-xl text-black leading-none"
          style={{ letterSpacing: "0.5px" }}
        >
          Quick Food
        </span>
        <span className="text-[10px] font-black tracking-[0.12em] text-black/55 uppercase mt-1">
          לוח בקרה למסעדן
        </span>
      </span>
    </Link>
  );
}

/**
 * Yellow hero card — same `bg + 2px black border + hard 6px shadow`
 * language used for the landing-page CTA cards. Hidden on mobile so
 * the form can take the full viewport.
 */
function HeroPanel() {
  return (
    <aside className="hidden lg:flex flex-col justify-between rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-9 min-h-130 relative overflow-hidden">
      {/* Rotating muted video + yellow tint + gradient. Sits below the
          content via z-0 / z-10 ordering. */}
      <AuthHeroVideo />

      <div className="relative z-10">
        <span className="inline-block bg-black text-[#F8CB1E] px-3 py-1 rounded-full text-[11px] font-black tracking-wider">
          QUICKFOOD · ניהול
        </span>
        <h2 className="mt-6 text-4xl lg:text-5xl font-black leading-[1.05] text-black">
          המסעדה שלך{" "}
          <span
            className="font-pacifico font-normal text-black"
            style={{ letterSpacing: "0.01em" }}
          >
            אונליין
          </span>
          <br />
          תוך 5 דקות.
          <br />
          <span className="text-black/65 text-3xl lg:text-4xl">
            לא להפך.
          </span>
        </h2>
      </div>

      <div className="relative z-10 space-y-3 mt-10">
        <FeatureRow>תפריט מלא, RTL, עברית מהשנייה הראשונה</FeatureRow>
        <FeatureRow>0% עמלת אגרגטור — אתה מקבל את ההזמנה ישירות</FeatureRow>
        <FeatureRow>תשלום אונליין מאובטח עם Grow Payments</FeatureRow>
      </div>
    </aside>
  );
}

function FeatureRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-xl border-2 border-black px-3.5 py-2.5 shadow-[0_2px_0_#000]">
      <span className="w-6 h-6 rounded-full bg-black grid place-items-center shrink-0">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12l4 4 10-10"
            stroke="#F8CB1E"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="text-sm font-bold text-black leading-snug">
        {children}
      </span>
    </div>
  );
}
