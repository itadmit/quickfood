/**
 * MenuItemImage — shows a real product image if available, otherwise renders
 * a tasteful, themed placeholder that matches the tenant's business type.
 *
 * The placeholder is intentionally NOT a cartoonish illustration; it uses
 * a soft gradient + a single elegant outline symbol + the item's name initials.
 *
 * Use this component everywhere a product needs to render. Pass the
 * tenant.businessType so the symbol matches the cuisine.
 */

import { cn } from "@/lib/cn";

export type BusinessType =
  | "pizza"
  | "burger"
  | "falafel"
  | "shawarma"
  | "sushi"
  | "asian"
  | "bakery"
  | "cafe"
  | "icecream"
  | "mediterranean"
  | "general";

export const BUSINESS_TYPES: Array<{ value: BusinessType; label: string }> = [
  { value: "pizza", label: "פיצרייה" },
  { value: "burger", label: "המבורגרים" },
  { value: "falafel", label: "פלאפל" },
  { value: "shawarma", label: "שווארמה" },
  { value: "sushi", label: "סושי" },
  { value: "asian", label: "אסיאתי" },
  { value: "bakery", label: "מאפייה" },
  { value: "cafe", label: "בית קפה" },
  { value: "icecream", label: "גלידרייה" },
  { value: "mediterranean", label: "ים תיכוני" },
  { value: "general", label: "כללי" },
];

interface Props {
  src?: string | null;
  alt: string;
  businessType?: BusinessType;
  size?: number;
  className?: string;
  rounded?: "md" | "lg" | "xl" | "2xl" | "full";
}

export function MenuItemImage({
  src,
  alt,
  businessType = "general",
  size = 96,
  className,
  rounded = "xl",
}: Props) {
  const roundedClass = {
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    "2xl": "rounded-2xl",
    full: "rounded-full",
  }[rounded];

  if (src) {
    // Real image — use plain <img> so we don't need next/image domain config
    // for R2 (the bucket may be on a custom CDN domain).
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={cn(
          "object-cover bg-qf-line-soft",
          roundedClass,
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Placeholder
      alt={alt}
      businessType={businessType}
      size={size}
      className={cn(roundedClass, className)}
    />
  );
}

function Placeholder({
  alt,
  businessType,
  size,
  className,
}: {
  alt: string;
  businessType: BusinessType;
  size: number;
  className?: string;
}) {
  const config = PLACEHOLDER_CONFIG[businessType];
  const initials = getInitials(alt);

  return (
    <div
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${config.from} 0%, ${config.to} 100%)`,
      }}
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        className,
      )}
      role="img"
      aria-label={alt}
    >
      {/* Subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `radial-gradient(circle, ${config.dot} 1px, transparent 1px)`,
          backgroundSize: `${Math.max(8, size / 8)}px ${Math.max(8, size / 8)}px`,
        }}
      />
      <Symbol type={businessType} color={config.symbol} size={size * 0.42} />
      {initials && size >= 80 && (
        <div
          className="absolute bottom-1.5 inset-e-2 font-bold tracking-tight"
          style={{
            color: config.symbol,
            fontSize: Math.max(10, size / 9),
            opacity: 0.85,
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

function getInitials(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("");
}

// ─── Color palettes ──────────────────────────────────────────────

const PLACEHOLDER_CONFIG: Record<
  BusinessType,
  { from: string; to: string; symbol: string; dot: string }
> = {
  pizza: { from: "#fbeed6", to: "#f0d59a", symbol: "#7a2d12", dot: "#7a2d12" },
  burger: { from: "#f7dcb7", to: "#d99560", symbol: "#5a2c0a", dot: "#5a2c0a" },
  falafel: { from: "#e5e9c6", to: "#bcc183", symbol: "#4a5224", dot: "#4a5224" },
  shawarma: { from: "#f3d9b6", to: "#c98756", symbol: "#5b2a0e", dot: "#5b2a0e" },
  sushi: { from: "#dde9e8", to: "#9bbcb7", symbol: "#1d3c39", dot: "#1d3c39" },
  asian: { from: "#fce6d8", to: "#e8a674", symbol: "#5a2a0e", dot: "#5a2a0e" },
  bakery: { from: "#f9eed8", to: "#d9bd84", symbol: "#5b3b14", dot: "#5b3b14" },
  cafe: { from: "#e8d9c5", to: "#b08961", symbol: "#3e2a16", dot: "#3e2a16" },
  icecream: { from: "#fadce8", to: "#e9a4c4", symbol: "#7a2b53", dot: "#7a2b53" },
  mediterranean: { from: "#dfe9d8", to: "#9fb98a", symbol: "#2c4624", dot: "#2c4624" },
  general: { from: "#ece6da", to: "#bdb39d", symbol: "#3a342a", dot: "#3a342a" },
};

// ─── Symbols ─────────────────────────────────────────────────────
// Each symbol is a single elegant outline glyph (1.5–2 strokeWidth)

function Symbol({ type, color, size }: { type: BusinessType; color: string; size: number }) {
  const stroke = color;
  const s = size;
  switch (type) {
    case "pizza":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M12 3l9 16H3z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="10" cy="14" r="1" fill={stroke} />
          <circle cx="14" cy="13" r="1" fill={stroke} />
          <circle cx="12" cy="10" r="1" fill={stroke} />
          <path d="M9 17h6" stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case "burger":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M4 9c0-2.5 3.6-4 8-4s8 1.5 8 4H4z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M3 13h18M3 16h18" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M4 19c0 1.5 1 2.5 3 2.5h10c2 0 3-1 3-2.5H4z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case "falafel":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M5 12c0-4 3-7 7-7s7 3 7 7l-2 8H7l-2-8z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="10" cy="12" r="1.3" fill={stroke} />
          <circle cx="14" cy="11" r="1.3" fill={stroke} />
          <circle cx="12" cy="14" r="1.3" fill={stroke} />
          <circle cx="11" cy="17" r="1.3" fill={stroke} />
          <circle cx="14" cy="16" r="1.3" fill={stroke} />
        </svg>
      );
    case "shawarma":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M7 4h10v3H7zM7 7l-1 14M17 7l1 14M6 21h12" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 10c1 0 2-.5 3 0s2 .5 3 0M9 14c1 0 2-.5 3 0s2 .5 3 0" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    case "sushi":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="12" rx="8" ry="5" stroke={stroke} strokeWidth="1.5" />
          <ellipse cx="12" cy="12" rx="4" ry="2.5" stroke={stroke} strokeWidth="1.2" />
          <circle cx="12" cy="12" r="1" fill={stroke} />
          <path d="M4 12c-1 0-2-.5-2-1.5M22 12c1 0 2-.5 2-1.5" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "asian":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M5 8c0-1 .5-2 7-2s7 1 7 2-.5 11-7 11S5 9 5 8z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 11l2 2 2-2 2 2" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 14l1.5 1.5M17 14l-1.5 1.5" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "bakery":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M4 14c0-3 3-5 8-5s8 2 8 5l-1 5H5l-1-5z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M8 11l1-3M12 9V6M16 11l-1-3" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "cafe":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M5 8h12v8c0 2-1 4-4 4H9c-3 0-4-2-4-4V8z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M17 10h2c1 0 2 1 2 2s-1 2-2 2h-2" stroke={stroke} strokeWidth="1.5" />
          <path d="M9 4c0 1 1 1.5 1 2.5M12 4c0 1 1 1.5 1 2.5" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "icecream":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M8 11a4 4 0 118 0v1h-8v-1z" stroke={stroke} strokeWidth="1.5" />
          <path d="M8 12l4 9 4-9" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="11" cy="9" r="0.8" fill={stroke} />
          <circle cx="13" cy="10" r="0.8" fill={stroke} />
        </svg>
      );
    case "mediterranean":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <ellipse cx="12" cy="13" rx="9" ry="3" stroke={stroke} strokeWidth="1.5" />
          <path d="M4 13c1 3 4 5 8 5s7-2 8-5" stroke={stroke} strokeWidth="1.5" />
          <ellipse cx="9" cy="11" rx="1.5" ry="1" fill={stroke} />
          <ellipse cx="14" cy="11" rx="1.5" ry="1" fill={stroke} />
          <path d="M8 8c2 0 3-1 4-1s2 1 4 1" stroke={stroke} strokeWidth="1.2" />
        </svg>
      );
    case "general":
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <path d="M4 7h16M5 7l1 13h12l1-13" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M9 11v6M15 11v6M12 11v6" stroke={stroke} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
  }
}
