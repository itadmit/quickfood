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
      <BusinessSymbol type={businessType} color={config.symbol} size={size * 0.42} />
    </div>
  );
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
// Lucide icons mapped to each business type.

import {
  Pizza,
  Hamburger,
  Salad,
  Fish,
  Soup,
  Coffee,
  Croissant,
  IceCream,
  Sandwich,
  CookingPot,
  UtensilsCrossed,
} from "lucide-react";

const SYMBOL: Record<BusinessType, React.ComponentType<{ size: number; color: string; strokeWidth: number }>> = {
  pizza: Pizza,
  burger: Hamburger,
  falafel: Salad,
  shawarma: Sandwich,
  sushi: Fish,
  asian: CookingPot,
  bakery: Croissant,
  cafe: Coffee,
  icecream: IceCream,
  mediterranean: Soup,
  general: UtensilsCrossed,
};

function BusinessSymbol({ type, color, size }: { type: BusinessType; color: string; size: number }) {
  const Icon = SYMBOL[type] ?? UtensilsCrossed;
  return <Icon size={size} color={color} strokeWidth={1.7} />;
}
