import Link from "next/link";
import { IcoArrowLeft } from "@/components/shared/Icons";

interface Props {
  /** Page title (e.g. "תנאי שימוש"). */
  title: string;
  /** Short page subtitle / context line under the title. */
  subtitle: string;
  /** ISO date string the document was last updated. Omit for evergreen pages. */
  lastUpdated?: string;
  /** Top-of-header chip label. Defaults to the legal-doc wording. */
  chipLabel?: string;
  /** Back-button destination. Defaults to /dashboard/login. */
  backHref?: string;
  /** Back-button label. Defaults to "להתחברות". */
  backLabel?: string;
  /** Sections of the document. */
  children: React.ReactNode;
}

/**
 * Shared shell for the public legal pages (terms, privacy). Same V2
 * brand language as the auth shell - cream surface with dot grid,
 * black-bordered + hard-shadow white content card, brand chip top
 * bar - so the merchant never feels like they've left the product.
 */
export function LegalShell({
  title,
  subtitle,
  lastUpdated,
  chipLabel = "QUICKFOOD · מסמך משפטי",
  backHref = "/dashboard/login",
  backLabel = "להתחברות",
  children,
}: Props) {
  return (
    <div
      className="dash-v2 min-h-screen text-black"
      style={{
        backgroundColor: "#FFFBEC",
        backgroundImage:
          "radial-gradient(circle, rgba(0,0,0,0.07) 1.5px, transparent 1.5px)",
        backgroundSize: "26px 26px",
      }}
    >
      {/* Top bar */}
      <header className="px-5 lg:px-10 pt-6 flex items-center justify-between gap-4">
        <BrandChip />
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-bold text-black bg-white px-4 py-2 rounded-full border-2 border-black shadow-[0_2px_0_#000] hover:shadow-[0_3px_0_#000] active:translate-y-px active:shadow-[0_1px_0_#000] transition"
        >
          <IcoArrowLeft c="#000" s={14} />
          <span className="hidden sm:inline text-black/70">חזרה</span>
          <span className="font-black">{backLabel}</span>
        </Link>
      </header>

      {/* Content */}
      <main className="px-5 lg:px-10 py-10 lg:py-14">
        <div className="mx-auto max-w-3xl">
          <header className="mb-8 lg:mb-10 space-y-3">
            <span className="inline-block bg-black text-[#F8CB1E] px-3 py-1 rounded-full text-[11px] font-black tracking-wider">
              {chipLabel}
            </span>
            <h1 className="text-3xl lg:text-5xl font-black tracking-tight leading-tight">
              {title}
            </h1>
            <p className="text-base text-black/65 leading-relaxed max-w-xl">
              {subtitle}
            </p>
            {lastUpdated && (
              <p className="text-xs font-bold text-black/55 tracking-wider uppercase">
                עודכן לאחרונה: {formatHebrewDate(lastUpdated)}
              </p>
            )}
          </header>

          <article className="bg-white rounded-3xl border-2 border-black shadow-[0_6px_0_#000] p-7 lg:p-10 legal-prose">
            {children}
          </article>

          <footer className="mt-10 text-center text-xs text-black/60">
            <p>
              שאלות?{" "}
              <a
                href="mailto:support@quickfood.co.il"
                className="font-black text-black underline underline-offset-2"
              >
                support@quickfood.co.il
              </a>
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

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

/**
 * "2026-05-24" → "24 במאי 2026". Stays a server-side function so the
 * markup is deterministic. Falls back to the raw string if the input
 * doesn't parse.
 */
function formatHebrewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = [
    "ינואר",
    "פברואר",
    "מרץ",
    "אפריל",
    "מאי",
    "יוני",
    "יולי",
    "אוגוסט",
    "ספטמבר",
    "אוקטובר",
    "נובמבר",
    "דצמבר",
  ];
  return `${d.getDate()} ב${months[d.getMonth()]} ${d.getFullYear()}`;
}
