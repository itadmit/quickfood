import Link from "next/link";
import { AuthHeroVideo } from "./AuthHeroVideo";
import { AuthRotatingTagline } from "./AuthRotatingTagline";

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
 * all wear this. Full-bleed yellow hero in the landing page's
 * "Triolla" treatment: video pinned to the visual-left edge that
 * melts via horizontal gradient into the yellow surface, dot pattern
 * across the whole field, and a bold white form card with 2px black
 * border + hard 6px shadow on the visual-right.
 *
 * Layout collapses to a single cream column on mobile (no video) so
 * the form has the full viewport on small screens without burning
 * data on a decorative video.
 */
export function AuthShell({ variant, children, title, subtitle }: Props) {
  return (
    // dash-v2 hooks the auth screens into the same token override the
    // V2 dashboard uses — green → yellow, surfaces → cream, ink/lines
    // → black. SignupForm's many inline qf-* utilities pick up the V2
    // palette for free, without rewriting each input.
    <div
      className="dash-v2 relative min-h-screen lg:h-screen lg:overflow-hidden text-black"
      style={{ backgroundColor: "#F8CB1E" }}
    >
      {/* ─── Dot pattern across the surface. Horizontal mask so the
              dots are dense across the YELLOW area on the visual-right
              and fade out to transparent on the visual-left where the
              video starts — instead of being covered awkwardly by the
              video, the pattern simply ends. The fade boundary sits
              around 42% (video edge) with a soft ramp from 35–55%. */}
      <div
        aria-hidden
        className="hidden lg:block absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.09) 1.5px, transparent 1.5px)",
          backgroundSize: "26px 26px",
          zIndex: 1,
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, transparent 35%, rgba(0,0,0,0.55) 55%, black 70%, black 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, transparent 35%, rgba(0,0,0,0.55) 55%, black 70%, black 100%)",
        }}
      />

      <aside
        aria-hidden
        className="absolute inset-0 lg:right-auto lg:w-[42%] z-0 lg:z-1 overflow-hidden"
      >
        <AuthHeroVideo />
        <div
          aria-hidden
          className="lg:hidden absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(248,203,30,0.95) 0%, rgba(248,203,30,0.65) 20%, rgba(248,203,30,0.30) 50%, rgba(248,203,30,0.65) 80%, rgba(248,203,30,0.95) 100%)",
          }}
        />
        <div
          aria-hidden
          className="hidden lg:block absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, transparent 0%, rgba(248,203,30,0.4) 35%, rgba(248,203,30,0.85) 65%, #F8CB1E 90%)",
          }}
        />
      </aside>

      {/* ─── Top bar — brand chip + cross-link, floats above everything ─── */}
      <header className="relative z-20 px-5 lg:px-10 pt-6 flex items-center justify-between gap-4">
        <BrandChip />
        <Link
          href={variant === "login" ? "/signup" : "/dashboard/login"}
          className="inline-flex items-center gap-2 text-sm font-bold text-black bg-white px-4 py-2 rounded-full border-2 border-black shadow-[0_2px_0_#000] hover:shadow-[0_3px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] transition"
        >
          <span className="hidden sm:inline text-black/70">
            {variant === "login" ? "עוד אין חשבון?" : "כבר יש לי חשבון?"}
          </span>
          <span className="font-black">
            {variant === "login" ? "הירשם בחינם ←" : "התחברות ←"}
          </span>
        </Link>
      </header>

      {/* ─── Main split — form on visual-RIGHT, video on visual-LEFT.
              RTL grid: first DOM child lands in the inline-start
              column (= visual right). So form is first, spacer
              (under the absolute video) is second. */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[58%_42%] min-h-[calc(100vh-88px)] lg:h-[calc(100vh-88px)]">
        {/* Form column — visual right (58%). */}
        <main className="flex items-center justify-center px-5 lg:px-12 py-6 lg:py-6">
          <div className="w-full max-w-md space-y-5">
            {/* Eyebrow + rotating marketing tagline above the card —
                a different one-liner shows on each visit so returning
                merchants don't see the same screen twice. Desktop only:
                on mobile the form already owns the viewport, and the
                tagline would compete with the card's own title. */}
            <div className="space-y-3 hidden lg:block">
              <span className="inline-block bg-black text-[#F8CB1E] px-3 py-1 rounded-full text-[11px] font-black tracking-wider">
                QUICKFOOD · ניהול
              </span>
              <AuthRotatingTagline />
            </div>

            <div className="bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-7 lg:p-9 space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight leading-tight">
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

        {/* Spacer column where the video lives (desktop only). On
            mobile this collapses out. */}
        <div className="hidden lg:block" aria-hidden />
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
    <Link href="/" className="group inline-flex items-center">
      <img
        src="/quickfood-mark-white.png"
        alt="QuickFood"
        width={56}
        height={56}
        className="w-14 h-14 rounded-xl border-2 border-black shadow-[0_3px_0_#000] group-active:translate-y-px group-active:shadow-[0_2px_0_#000] transition shrink-0"
      />
    </Link>
  );
}
