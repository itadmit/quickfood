import Link from "next/link";
import Image from "next/image";
import { QuickFoodLogo } from "@/components/shared/QuickFoodLogo";

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
   * Kept for backwards compatibility; ignored now that the marketing panel is
   * a single hero photo instead of a tilted dashboard preview.
   */
  illustration?: "kanban" | "menu";
}

export function AuthShell({
  variant,
  children,
  title,
  subtitle,
}: Props) {
  return (
    <div className="min-h-screen bg-white text-qf-ink grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* ─── Left: full-bleed diner photo with text overlay ─── */}
      <aside className="hidden lg:block relative overflow-hidden border-e border-qf-line-dash">
        <Image
          src="/img/auth/diner.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 0px, 55vw"
          className="object-cover"
        />
        {/* Top→bottom dark gradient so the white logo + copy at the corners
            stay legible regardless of where the diner's bright neon falls. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-b from-black/55 via-black/15 to-black/75"
        />

        {/* Logo top-corner, in white */}
        <div className="absolute top-6 inset-s-6 z-10 text-white">
          <QuickFoodLogo size={32} wordmarkClassName="text-lg" />
        </div>

        {/* Tagline at the bottom */}
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="text-2xl font-semibold leading-snug max-w-md drop-shadow-md">
            המסעדה שלך אונליין{" "}
            <span className="text-qf-yolk">תוך 11 דקות</span>.
            <br />
            לא להפך.
          </p>
          <div className="mt-5 flex items-center gap-5 text-xs text-white/85">
            <FeatureCheck>עברית מלאה</FeatureCheck>
            <FeatureCheck>RTL</FeatureCheck>
            <FeatureCheck>0% עמלת אגרגטור</FeatureCheck>
          </div>
        </div>
      </aside>

      {/* ─── Right: form panel (pure white) ─── */}
      <main className="relative flex flex-col">
        {/* top bar inside the right column */}
        <header className="flex items-center justify-between px-6 py-5">
          <Link
            href={variant === "login" ? "/signup" : "/dashboard/login"}
            className="text-sm text-qf-mute hover:text-qf-ink inline-flex items-center gap-1.5"
          >
            {variant === "login" ? (
              <>
                עוד אין חשבון?
                <span className="font-semibold text-qf-ink">הירשם בחינם →</span>
              </>
            ) : (
              <>
                כבר יש לי חשבון
                <span className="font-semibold text-qf-ink">→ התחברות</span>
              </>
            )}
          </Link>
          {/* mobile-only logo since the aside is hidden */}
          <div className="lg:hidden">
            <QuickFoodLogo size={28} wordmarkClassName="text-base" />
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-qf-mute">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureCheck({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 12l4 4 10-10"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </span>
  );
}
