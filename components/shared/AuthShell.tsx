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
      {/* ─── Dot pattern across the entire surface. Faded to transparent
              toward the bottom via mask-image so the pattern frames the
              top of the screen and clears out under the form card. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.09) 1.5px, transparent 1.5px)",
          backgroundSize: "26px 26px",
          zIndex: 1,
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, black 35%, rgba(0,0,0,0.55) 70%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, black 0%, black 35%, rgba(0,0,0,0.55) 70%, transparent 100%)",
        }}
      />

      {/* ─── Full-bleed video pinned to the VISUAL-RIGHT edge of the
              viewport (desktop only). In RTL `right: 0` is the
              geometric right edge regardless of dir. Eyes in Hebrew
              flow right→left, so anchoring the decorative video at the
              start of the read and the form at the end keeps the
              visual hierarchy intuitive.

              Hosts the rotating marketing tagline + eyebrow pill in
              its bottom area (visual-LEFT side, where the gradient
              has already faded the video to solid yellow → text stays
              legible without a scrim). */}
      <aside
        aria-hidden
        className="hidden lg:block absolute inset-y-0 w-[42%] z-1 overflow-hidden"
        style={{ right: 0, left: "auto" }}
      >
        <AuthHeroVideo />
        {/* Horizontal yellow melt — mirrors the landing-page
            `.heroMedia::after` but flipped: clear video on the
            visual-right edge, dissolves into the brand yellow well
            before reaching the visual-left edge. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to left, transparent 0%, rgba(248,203,30,0.4) 35%, rgba(248,203,30,0.85) 65%, #F8CB1E 90%)",
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

      {/* ─── Main split — video on visual-RIGHT, form on visual-LEFT.
              RTL grid: first DOM child lands in the inline-start
              column (= visual right). So the spacer (under the
              absolute video) is first, form is second. */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[42%_58%] lg:h-[calc(100vh-88px)]">
        {/* Spacer column where the video lives (desktop only). On
            mobile this collapses out. */}
        <div className="hidden lg:block" aria-hidden />

        {/* Form column — visual left (58%). Just the form card —
            marketing voice lives in the video column. */}
        <main className="flex items-center justify-center px-5 lg:px-12 py-10 lg:py-6">
          <div className="w-full max-w-md">
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
        <span className="text-[10px] font-black tracking-[0.12em] text-black/65 uppercase mt-1">
          לוח בקרה למסעדן
        </span>
      </span>
    </Link>
  );
}
