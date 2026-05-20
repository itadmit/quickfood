import Link from "next/link";
import { QuickFoodLogo } from "@/components/shared/QuickFoodLogo";
import { DashboardPreview } from "@/components/shared/DashboardPreview";

interface Props {
  /** "login" or "signup" — controls the top-bar cross-link */
  variant: "login" | "signup";
  /** Right column content (the form) */
  children: React.ReactNode;
  /** Headline above the form (e.g. "ברוך השב.") */
  title: string;
  /** Subtitle below the headline */
  subtitle: string;
  /** Optional decoration variant key passed to the dashboard preview tilt */
  illustration?: "kanban" | "menu";
}

export function AuthShell({
  variant,
  children,
  title,
  subtitle,
  illustration = "kanban",
}: Props) {
  return (
    <div className="min-h-screen bg-white text-qf-ink grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* ─── Left: marketing panel (distinct cream background + blur orbs) ─── */}
      <aside className="hidden lg:flex relative overflow-hidden border-e border-qf-line-dash bg-[#f5f2ec]">
        {/* decorative blur orbs */}
        <div
          aria-hidden
          className="absolute top-1/3 inset-e-1/4 w-96 h-96 rounded-full bg-violet-300/30 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute bottom-1/4 inset-s-1/4 w-96 h-96 rounded-full bg-fuchsia-300/20 blur-3xl"
        />
        {/* logo top-corner */}
        <div className="absolute top-6 inset-s-6 z-10">
          <QuickFoodLogo size={32} wordmarkClassName="text-lg" />
        </div>

        <div className="relative w-full flex flex-col justify-center p-12">
          <div className="w-full max-w-lg mx-auto">
            <DashboardPreview variant={illustration} className="shadow-2xl" />
          </div>
          <div className="mt-10 text-center max-w-md mx-auto">
            <p className="text-qf-ink2 text-sm leading-relaxed">
              ה-SaaS הישראלי שמרים מסעדה אונליין{" "}
              <span className="font-semibold text-qf-ink">תוך 11 דקות</span>, לא להפך.
            </p>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-qf-mute">
              <FeatureCheck>עברית מלאה</FeatureCheck>
              <FeatureCheck>RTL</FeatureCheck>
              <FeatureCheck>0% עמלת אגרגטור</FeatureCheck>
            </div>
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
          stroke="var(--qf-primary)"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </span>
  );
}
