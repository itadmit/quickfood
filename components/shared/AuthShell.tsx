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
    <div className="min-h-screen bg-qf-bg-dash text-qf-ink flex flex-col">
      {/* Top bar */}
      <header className="px-6 py-5 flex items-center justify-between max-w-[1400px] w-full mx-auto">
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
        <QuickFoodLogo size={32} wordmarkClassName="text-lg" />
      </header>

      {/* Main split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] max-w-[1400px] w-full mx-auto px-6 pb-10 gap-10">
        {/* Left: marketing + illustration */}
        <aside className="hidden lg:flex flex-col items-center justify-center text-center gap-8 pe-4">
          <DashboardPreview variant={illustration} />
          <div className="max-w-md space-y-3">
            <p className="text-xl font-semibold leading-snug">
              ה-SaaS הישראלי שמרים מסעדה אונליין{" "}
              <span className="text-(--qf-primary)">תוך 11 דקות</span>.
            </p>
            <div className="flex items-center justify-center gap-5 text-xs text-qf-mute">
              <FeatureCheck>עברית מלאה</FeatureCheck>
              <FeatureCheck>RTL</FeatureCheck>
              <FeatureCheck>0% עמלת אגרגטור</FeatureCheck>
            </div>
          </div>
        </aside>

        {/* Right: form panel */}
        <main className="flex items-center">
          <div className="w-full max-w-md mx-auto lg:me-0 lg:ms-auto space-y-8">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-qf-mute">{subtitle}</p>
            </div>
            {children}
          </div>
        </main>
      </div>
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
