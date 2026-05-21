"use client";

import Link from "next/link";
import { IcoPin, IcoSearch, IcoClock, IcoBike, IcoUser, IcoArrowLeft, IcoStar } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { BottomTabBar } from "@/components/customer/BottomTabBar";
import { CampaignPopup } from "@/components/customer/CampaignPopup";
import { CampaignBanner, type CampaignBannerData } from "@/components/customer/CampaignBanner";
import { ReorderRail } from "@/components/customer/ReorderRail";
import { resolveCategoryStyle } from "@/lib/category-style";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { SmartImg } from "@/components/shared/SmartImg";
import { cn } from "@/lib/cn";

interface Props {
  tenant: {
    id: string;
    slug: string;
    name: string;
    logoLetter: string;
    logoUrl?: string | null;
    cuisineType: string | null;
    businessType?: BusinessType;
    coverImage?: string | null;
  };
  branch: {
    address: string;
    status: string;
    deliveryFee: number;
    minOrder: number;
  } | null;
  categories: Array<{ id: string; name: string; icon: string | null; color: string | null }>;
  popular: Array<{
    id: string;
    name: string;
    description: string;
    basePrice: number;
    artType: string | null;
    images?: string[];
  }>;
  recentOrders?: Array<{
    id: string;
    number: string;
    total: number;
    status: string;
    created_at: string;
    item_count: number;
    headline_item: string | null;
    headline_image: string | null;
  }>;
  bannerCampaign?: CampaignBannerData | null;
  hasCustomerSession?: boolean;
  pendingReviewOrderId?: string | null;
  children?: React.ReactNode;
}

export function CustomerHome({
  tenant,
  branch,
  categories,
  popular,
  recentOrders = [],
  bannerCampaign = null,
  hasCustomerSession = false,
  pendingReviewOrderId = null,
  children,
}: Props) {
  const { method, setMethod } = useCart();
  const open = branch?.status === "open";

  const hasCover = Boolean(tenant.coverImage);

  return (
    <div className="pb-20 lg:pb-12">
      {/* Unified hero: cover image (if any) replaces the green background.
          Mobile keeps the rounded-bottom card look; desktop goes full-bleed
          with content centered in a max-w-7xl band. */}
      <header className="relative text-white px-5 pt-5 pb-12 overflow-hidden isolate rounded-b-3xl lg:rounded-none lg:px-6 lg:pt-12 lg:pb-16">
        {hasCover ? (
          <>
            <SmartImg
              src={tenant.coverImage!}
              alt=""
              fill
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 -z-10"
            />
            <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/55 via-black/35 to-black/65" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-linear-to-b from-(--qf-primary) to-(--qf-deep)" />
        )}

        <div className="lg:max-w-7xl lg:mx-auto">
          {/* Mobile-only top row (location + profile). Desktop has these in the
              top nav already, so hide here. */}
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur px-3 py-1.5 rounded-full text-sm">
              <IcoPin c="#fff" s={14} />
              <span className="truncate max-w-45">{branch?.address ?? "—"}</span>
            </div>
            <Link
              href={`/${tenant.slug}/profile`}
              aria-label="אזור אישי"
              className="w-9 h-9 rounded-full bg-white grid place-items-center"
            >
              <IcoUser c="var(--qf-deep)" s={18} />
            </Link>
          </div>

          {/* Tenant name — promoted to a prominent title on desktop */}
          <div className="hidden lg:flex items-center gap-4 mb-6">
            {tenant.logoUrl && (
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white shadow-md grid place-items-center shrink-0">
                <SmartImg
                  src={tenant.logoUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="object-contain w-full h-full"
                />
              </div>
            )}
            <div>
              <h1 className="text-4xl font-bold drop-shadow-md">{tenant.name}</h1>
              {tenant.cuisineType && (
                <div className="text-base text-white/90 drop-shadow mt-1">{tenant.cuisineType}</div>
              )}
            </div>
          </div>

          {/* Delivery / Pickup tabs */}
          <div className="bg-white/20 backdrop-blur rounded-2xl p-1 grid grid-cols-2 mb-4 lg:max-w-sm">
            {(["delivery", "pickup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  "py-2 text-sm rounded-xl transition font-medium",
                  method === m ? "bg-white text-(--qf-deep) shadow" : "text-white/85",
                )}
              >
                {m === "delivery" ? "משלוח" : "איסוף"}
              </button>
            ))}
          </div>

          {/* Search */}
          <Link
            href={`/${tenant.slug}/menu`}
            className="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2.5 rounded-full text-white/85 text-sm border border-white/25 lg:max-w-md"
          >
            <IcoSearch c="rgba(255,255,255,0.85)" s={16} />
            <span>חיפוש בתפריט</span>
          </Link>

          {/* Mobile-only tenant name (desktop renders it at the top of the hero).
              Small logo chip sits next to the name when uploaded. */}
          <div className="mt-6 lg:hidden flex items-center gap-2.5">
            {tenant.logoUrl && (
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-white shadow-sm grid place-items-center shrink-0">
                <SmartImg
                  src={tenant.logoUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="object-contain w-full h-full"
                />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight drop-shadow-md truncate">{tenant.name}</h1>
              {tenant.cuisineType && (
                <div className="text-sm text-white/90 drop-shadow truncate">{tenant.cuisineType}</div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Thin info bar — pulled up so it straddles the seam between the
          cover image and the body: half on the hero, half on the body. */}
      <section className="px-5 -mt-6 relative z-10 lg:max-w-7xl lg:mx-auto lg:px-6 lg:-mt-7">
        <div className="bg-white border border-qf-line rounded-full shadow-sm px-4 py-3 flex items-center justify-center gap-4 text-sm lg:max-w-2xl lg:mx-auto">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-medium",
              open ? "text-qf-green-deep" : "text-qf-tomato",
            )}
          >
            <span className={cn("w-2 h-2 rounded-full", open ? "bg-qf-green-deep" : "bg-qf-tomato")} />
            {open ? "פתוח" : "סגור"}
          </span>
          <span className="text-qf-line">·</span>
          <span className="inline-flex items-center gap-1.5 text-qf-ink2">
            <IcoClock s={13} c="#7c8a82" />
            <span>25–35 דק&apos;</span>
          </span>
          <span className="text-qf-line">·</span>
          <span className="inline-flex items-center gap-1.5 text-qf-ink2">
            <IcoBike s={14} c="#7c8a82" />
            <span>{branch ? formatPrice(branch.deliveryFee) : "—"}</span>
          </span>
        </div>
      </section>

      {/* Pending-review banner — surfaces when a delivered order is waiting
          for the customer's rating. Click jumps straight to the review card
          on the order tracking page. */}
      {pendingReviewOrderId && (
        <section className="px-5 mt-4 lg:max-w-7xl lg:mx-auto lg:px-6">
          <Link
            href={`/${tenant.slug}/orders/${pendingReviewOrderId}#review`}
            className="flex items-center gap-3 bg-white border border-(--qf-primary)/30 rounded-2xl p-3 shadow-sm"
          >
            <div className="w-10 h-10 rounded-full bg-qf-yolk/20 grid place-items-center shrink-0">
              <IcoStar c="#e8a93b" fill="#e8a93b" s={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">רוצה לדרג את ההזמנה האחרונה?</div>
              <div className="text-xs text-qf-mute">דקה אחת כדי לתת ביקורת</div>
            </div>
            <IcoArrowLeft c="#7c8a82" s={14} />
          </Link>
        </section>
      )}

      {/* Merchant-managed inline banner (kind=banner). Server-rendered so it
          appears without a flash; renders nothing if no active banner exists. */}
      <CampaignBanner tenantSlug={tenant.slug} banner={bannerCampaign} />

      {/* Previous orders rail — up to 3 distinct past orders.  For guests the
          rail hydrates from localStorage on the client (with a skeleton while
          it loads); for logged-in customers we server-render the initial list. */}
      <ReorderRail
        tenantSlug={tenant.slug}
        businessType={tenant.businessType ?? "general"}
        initialOrders={recentOrders}
        hasCustomerSession={hasCustomerSession}
      />

      {/* Categories — horizontal scroll on mobile, wrap-grid on desktop */}
      <section className="px-5 mt-5 lg:max-w-7xl lg:mx-auto lg:px-6 lg:mt-10">
        <h2 className="text-base lg:text-xl font-semibold mb-2 lg:mb-4">קטגוריות</h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5 lg:mx-0 lg:px-0 lg:overflow-visible lg:grid lg:grid-cols-6 xl:grid-cols-8 lg:gap-3">
          {categories.map((c) => {
            const style = resolveCategoryStyle(c.icon, c.color);
            const Icon = style.Icon;
            return (
              <Link
                key={c.id}
                href={`/${tenant.slug}/menu#cat-${c.id}`}
                className="shrink-0 bg-white rounded-2xl border border-qf-line px-4 py-3 min-w-22 text-center hover:border-(--qf-primary)/40 hover:shadow-sm transition lg:min-w-0"
              >
                <div
                  className="w-10 h-10 rounded-full grid place-items-center mx-auto mb-1"
                  style={{ backgroundColor: style.bg }}
                >
                  <Icon size={20} color={style.fg} strokeWidth={1.8} />
                </div>
                <div className="text-xs font-medium">{c.name}</div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Popular items — horizontal scroll on mobile, multi-col grid on desktop */}
      {popular.length > 0 && (
        <section className="px-5 mt-5 lg:max-w-7xl lg:mx-auto lg:px-6 lg:mt-10">
          <div className="flex items-center justify-between mb-2 lg:mb-4">
            <h2 className="text-base lg:text-xl font-semibold">פופולריים</h2>
            <Link href={`/${tenant.slug}/menu`} className="text-xs lg:text-sm text-(--qf-deep) inline-flex items-center gap-1 hover:underline">
              לכל התפריט
              <IcoArrowLeft c="currentColor" s={12} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2 lg:mx-0 lg:px-0 lg:overflow-visible lg:grid lg:grid-cols-4 xl:grid-cols-6 lg:gap-4 lg:pb-0">
            {popular.map((item) => (
              <Link
                key={item.id}
                href={`/${tenant.slug}/menu/${item.id}`}
                className="shrink-0 w-44 bg-white rounded-2xl border border-qf-line overflow-hidden hover:border-(--qf-primary)/40 hover:shadow-sm transition lg:w-auto"
              >
                <div className="relative aspect-square overflow-hidden">
                  <MenuItemImage
                    src={item.images?.[0]}
                    alt={item.name}
                    businessType={tenant.businessType ?? "general"}
                    size={176}
                    rounded="none"
                    fill
                    className="w-full h-full"
                  />
                </div>
                <div className="p-3">
                  <div className="font-medium text-sm leading-tight line-clamp-1">{item.name}</div>
                  <div className="text-xs text-qf-mute line-clamp-2 mt-1">{item.description}</div>
                  <div className="text-sm font-semibold mt-2 tnum">{formatPrice(item.basePrice)}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {children}

      <BottomTabBar tenantSlug={tenant.slug} />
      <CampaignPopup tenantSlug={tenant.slug} />
    </div>
  );
}
