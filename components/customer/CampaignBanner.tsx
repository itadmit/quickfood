import Link from "next/link";
import { SmartImg } from "@/components/shared/SmartImg";
import { resolveCategoryStyle } from "@/lib/category-style";

export interface CampaignBannerData {
  id: string;
  style: "image" | "text";
  title: string;
  subtitle: string | null;
  icon: string | null;
  color: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
}

interface Props {
  tenantSlug: string;
  banner: CampaignBannerData | null;
}

/**
 * Inline home-page banner - server-rendered alongside the rest of the home
 * page so it appears without a flash. Two render modes:
 *   - style="image" - merchant-uploaded wide image (16:9 / 21:9)
 *   - style="text"  - accent-colored card with chosen icon, title, optional subtitle
 *
 * Icons + colors are drawn from the same registry as menu categories (see
 * lib/category-style.ts), so the merchant has the full palette available.
 *
 * If `linkUrl` starts with `/`, it's resolved relative to the tenant slug
 * (so merchants can write `/menu` and have it land on /<slug>/menu);
 * absolute http(s) URLs are used as-is.
 */
export function CampaignBanner({ tenantSlug, banner }: Props) {
  if (!banner) return null;

  // An image-style banner with no actual image would render an empty box -
  // skip it. The merchant UI prevents this, but be defensive at the boundary.
  if (banner.style === "image" && !banner.imageUrl) return null;

  const href = resolveHref(tenantSlug, banner.linkUrl);

  const body = banner.style === "image" ? <ImageBody banner={banner} /> : <TextBody banner={banner} />;

  return (
    <section className="px-5 mt-3 lg:max-w-7xl lg:mx-auto lg:px-6 lg:mt-6">
      {href ? (
        <Link href={href} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </section>
  );
}

function ImageBody({ banner }: { banner: CampaignBannerData }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-qf-line shadow-sm aspect-21/9 bg-qf-line-soft">
      <SmartImg
        src={banner.imageUrl!}
        alt={banner.title}
        fill
        loading="eager"
        className="w-full h-full"
      />
    </div>
  );
}

function TextBody({ banner }: { banner: CampaignBannerData }) {
  const style = resolveCategoryStyle(banner.icon, banner.color);
  const Icon = style.Icon;
  return (
    <div
      className="rounded-2xl border border-qf-line p-4 flex items-center gap-3 shadow-sm"
      style={{ backgroundColor: style.bg }}
    >
      {/* Translucent white well lifts the icon off the tinted background and
          keeps the icon readable across all 8 palettes. */}
      <div className="rounded-xl p-3 shrink-0 bg-white/55">
        <Icon size={28} color={style.fg} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold leading-tight" style={{ color: style.fg }}>
          {banner.title}
        </div>
        {banner.subtitle && (
          <div className="text-xs text-qf-ink2 mt-0.5">{banner.subtitle}</div>
        )}
      </div>
    </div>
  );
}

function resolveHref(tenantSlug: string, linkUrl: string | null): string | null {
  if (!linkUrl) return null;
  if (/^https?:\/\//i.test(linkUrl)) return linkUrl;
  if (linkUrl.startsWith("/")) {
    return linkUrl === "/" ? `/s/${tenantSlug}` : `/s/${tenantSlug}${linkUrl}`;
  }
  return null;
}
