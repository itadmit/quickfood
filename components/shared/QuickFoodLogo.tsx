import Link from "next/link";
import { cn } from "@/lib/cn";

interface QuickFoodLogoProps {
  href?: string | null;
  className?: string;
  /** Visual size of the icon in px. Default 32. */
  size?: number;
  /** Show the "Quick Food" wordmark next to the icon. Default true. */
  showWordmark?: boolean;
  /** Tailwind utility for the wordmark text size. Default text-xl. */
  wordmarkClassName?: string;
}

/**
 * QuickFood brand lockup - purple gradient icon with a script "F" + the
 * "Quick Food" wordmark, both in Pacifico.
 *
 * The icon is rendered as inline SVG (not <img>) so the <text> inside picks
 * up the Pacifico font from next/font on the page. A static fallback file
 * lives at /branding/icon.svg for places that need a URL (favicon, OG image,
 * <link rel> tags).
 *
 * For per-tenant restaurant branding use Tenant.logoLetter / logoUrl - this
 * lockup is for the *platform* brand only.
 */
export function QuickFoodLogo({
  href = "/",
  className,
  size = 32,
  showWordmark = true,
  wordmarkClassName = "text-xl",
}: QuickFoodLogoProps) {
  const content = (
    <>
      <span
        className="shrink-0 inline-block rounded-lg shadow-sm overflow-hidden"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 32 32"
          width={size}
          height={size}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="QuickFood"
        >
          <defs>
            <linearGradient id="qf-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          <rect width="32" height="32" rx="8" fill="url(#qf-grad)" />
          <text
            x="16"
            y="24"
            textAnchor="middle"
            fontSize="22"
            fill="#ffffff"
            className="font-pacifico"
          >
            F
          </text>
        </svg>
      </span>
      {showWordmark && (
        <span
          className={cn("font-pacifico leading-none", wordmarkClassName)}
          style={{ letterSpacing: "0.5px" }}
        >
          Quick Food
        </span>
      )}
    </>
  );

  if (!href) {
    return (
      <div className={cn("flex items-center gap-2 min-w-0", className)}>
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 min-w-0", className)}
    >
      {content}
    </Link>
  );
}
