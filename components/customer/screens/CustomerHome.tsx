"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IcoPin, IcoSearch, IcoClock, IcoBike, IcoUser, IcoArrowLeft, IcoStar } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { BottomTabBar } from "@/components/customer/BottomTabBar";
import { CampaignPopup } from "@/components/customer/CampaignPopup";
import { CampaignBanner, type CampaignBannerData } from "@/components/customer/CampaignBanner";
import { ReorderRail } from "@/components/customer/ReorderRail";
import { CityPickerModal } from "@/components/customer/CityPickerModal";
import {
  MenuList,
  NoticeCard,
  type MenuListItem,
  type NoticeRow,
} from "@/components/customer/MenuList";
import { useMenuSearch } from "@/components/customer/MenuSearchProvider";
import { resolveCategoryStyle } from "@/lib/category-style";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { SmartImg } from "@/components/shared/SmartImg";
import {
  readDeliveryChoice,
  writeDeliveryChoice,
  type DeliveryChoice,
} from "@/lib/delivery-city-storage";
import { cn } from "@/lib/cn";

interface Props {
  tenant: {
    id: string;
    slug: string;
    name: string;
    logoLetter: string;
    logoUrl?: string | null;
    cuisineType: string | null;
    about?: string | null;
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
  /** All active categories for the inline menu list below (the `categories`
   *  prop above is capped at 8 for the icon rail). */
  allCategories: Array<{ id: string; name: string; icon: string | null; color: string | null }>;
  menuItems: MenuListItem[];
  notices?: NoticeRow[];
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
  /** Union of cities the tenant's active delivery zones cover. The
   *  storefront uses this for the Wolt-style "select your city"
   *  picker; empty = merchant hasn't configured zones, picker still
   *  offers pickup as an option. */
  deliveryCities?: string[];
  /** Tenant-level toggle ("הגדרות → קופה → אפשר איסוף עצמי"). When false the
   *  "איסוף" tab on the storefront becomes a disabled affordance — clicking
   *  it opens the picker modal explaining the store is delivery-only. */
  pickupEnabled?: boolean;
  bannerCampaign?: CampaignBannerData | null;
  hasCustomerSession?: boolean;
  pendingReviewOrderId?: string | null;
}

export function CustomerHome({
  tenant,
  branch,
  categories,
  allCategories,
  menuItems,
  notices = [],
  popular,
  recentOrders = [],
  deliveryCities = [],
  pickupEnabled = true,
  bannerCampaign = null,
  hasCustomerSession = false,
  pendingReviewOrderId = null,
}: Props) {
  const { method, setMethod } = useCart();
  const open = branch?.status === "open";

  const hasCover = Boolean(tenant.coverImage);

  // Wolt-style "select your delivery city" flow. On first visit the
  // modal opens automatically; once the customer has answered (city OR
  // pickup), we persist their choice in localStorage and keep the
  // location chip in the hero clickable to change it later.
  const [choice, setChoice] = useState<DeliveryChoice>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRequired, setPickerRequired] = useState(false);

  // Search query is now layout-level (lives in MenuSearchProvider) so the
  // desktop header search input and the sticky mobile search input share
  // a single source of truth. Dietary-tag filter stays local — it's only
  // ever rendered inside the menu section.
  const { query: menuQuery, setQuery: setMenuQuery } = useMenuSearch();
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const menuSearchRef = useRef<HTMLInputElement | null>(null);

  function focusMenuSearch() {
    const el = document.getElementById("menu-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => menuSearchRef.current?.focus(), 400);
  }

  function toggleTag(t: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  useEffect(() => {
    const existing = readDeliveryChoice(tenant.slug);
    // A stored choice can go stale if the merchant later turns off the
    // method the customer picked (removed all delivery zones / disabled
    // pickup). Treat it as no choice so the picker re-opens and the
    // customer re-confirms with the methods that are currently offered.
    const stale =
      (existing?.kind === "delivery" && deliveryCities.length === 0) ||
      (existing?.kind === "pickup" && !pickupEnabled);
    setChoice(stale ? null : existing);
    if (!existing || stale) {
      setPickerOpen(true);
      setPickerRequired(true);
    }
  }, [tenant.slug, deliveryCities.length, pickupEnabled]);

  function applyChoice(next: { kind: "delivery"; city: string } | { kind: "pickup" }) {
    setChoice(next);
    writeDeliveryChoice(tenant.slug, next);
    setMethod(next.kind === "delivery" ? "delivery" : "pickup");
    setPickerOpen(false);
    setPickerRequired(false);
  }

  const storeNotices = useMemo(() => notices.filter((n) => n.scope === "store"), [notices]);
  const noticesByCategory = useMemo(() => {
    const m = new Map<string, NoticeRow[]>();
    for (const n of notices) {
      if (n.scope === "category" && n.categoryId) {
        if (!m.has(n.categoryId)) m.set(n.categoryId, []);
        m.get(n.categoryId)!.push(n);
      }
    }
    return m;
  }, [notices]);
  const noticesByItem = useMemo(() => {
    const m = new Map<string, NoticeRow[]>();
    for (const n of notices) {
      if (n.scope === "item" && n.itemId) {
        if (!m.has(n.itemId)) m.set(n.itemId, []);
        m.get(n.itemId)!.push(n);
      }
    }
    return m;
  }, [notices]);

  const locationLabel =
    choice?.kind === "pickup"
      ? "איסוף עצמי"
      : choice?.kind === "delivery"
        ? choice.city
        : "בחר כתובת";

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
            <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/70 via-black/55 to-black/80" />
          </>
        ) : (
          <div className="absolute inset-0 -z-10 bg-linear-to-b from-(--qf-primary) to-(--qf-deep)" />
        )}

        <div className="lg:max-w-7xl lg:mx-auto">
          {/* Mobile-only top row (location + profile). Desktop has these in the
              top nav already, so hide here. */}
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <button
              type="button"
              onClick={() => {
                setPickerRequired(false);
                setPickerOpen(true);
              }}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-1.5 rounded-full text-sm transition"
            >
              <IcoPin c="#fff" s={14} />
              <span className="truncate max-w-45">{locationLabel}</span>
            </button>
            <Link
              href={`/s/${tenant.slug}/profile`}
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
              {tenant.about && (
                <div className="text-sm text-white/85 drop-shadow mt-2 leading-relaxed whitespace-pre-line line-clamp-4 max-w-xl">
                  {tenant.about}
                </div>
              )}
            </div>
          </div>

          {/* Delivery / Pickup tabs. When a method isn't offered (no
              delivery cities OR pickup disabled by the merchant) the tab
              stays visible but reads as muted, and tapping it pops the
              picker modal so the customer understands why and can switch. */}
          <div className="bg-white/20 backdrop-blur rounded-2xl p-1 grid grid-cols-2 mb-4 lg:max-w-sm">
            {(["delivery", "pickup"] as const).map((m) => {
              const available =
                m === "delivery" ? deliveryCities.length > 0 : pickupEnabled;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    if (!available) {
                      setPickerRequired(false);
                      setPickerOpen(true);
                      return;
                    }
                    setMethod(m);
                  }}
                  aria-disabled={!available}
                  title={
                    available
                      ? undefined
                      : m === "delivery"
                        ? "המסעדה לא מספקת משלוחים"
                        : "המסעדה לא מציעה איסוף עצמי"
                  }
                  className={cn(
                    "py-2 text-sm rounded-xl transition font-medium",
                    method === m && available
                      ? "bg-white text-(--qf-deep) shadow"
                      : "text-white/85",
                    !available && "opacity-60",
                  )}
                >
                  {m === "delivery" ? "משלוח" : "איסוף"}
                </button>
              );
            })}
          </div>

          {/* Search trigger — looks like an input but is a button. Tapping
              scrolls down to the inline menu and focuses the real search
              field there. Hidden on desktop since the menu (and its own
              search input) is visible immediately without scroll. */}
          <button
            type="button"
            onClick={focusMenuSearch}
            className="lg:hidden w-full flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur px-4 py-2.5 rounded-full text-sm border border-white/25 text-start transition"
          >
            <IcoSearch c="rgba(255,255,255,0.9)" s={16} />
            <span className="text-white/85">חיפוש בתפריט</span>
          </button>

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
              {tenant.about && (
                <div className="text-xs text-white/85 drop-shadow mt-1.5 leading-relaxed whitespace-pre-line line-clamp-3">
                  {tenant.about}
                </div>
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
            href={`/s/${tenant.slug}/orders/${pendingReviewOrderId}#review`}
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
                href={`#cat-${c.id}`}
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
            <a
              href="#menu-section"
              className="text-xs lg:text-sm text-(--qf-deep) inline-flex items-center gap-1 hover:underline"
            >
              לכל התפריט
              <IcoArrowLeft c="currentColor" s={12} />
            </a>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2 lg:mx-0 lg:px-0 lg:overflow-visible lg:grid lg:grid-cols-4 xl:grid-cols-6 lg:gap-4 lg:pb-0">
            {popular.map((item) => (
              <Link
                key={item.id}
                href={`/s/${tenant.slug}/menu/${item.id}`}
                scroll={false}
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

      {/* Inline full menu — Wolt-style. Sticky category chip bar +
          scroll-spy. BottomTabBar uses the `menu-section` id below to
          highlight the "תפריט" tab when this band enters the viewport. */}
      {menuItems.length > 0 && (
        <section
          id="menu-section"
          className="px-5 mt-8 lg:max-w-7xl lg:mx-auto lg:px-6 lg:mt-12 scroll-mt-2"
        >
          {storeNotices.length > 0 && (
            <div className="space-y-2 mb-3">
              {storeNotices.map((n) => (
                <NoticeCard key={n.id} notice={n} />
              ))}
            </div>
          )}
          <h2 className="text-base lg:text-xl font-semibold mb-3">התפריט המלא</h2>
          {/* Mobile-only search input — sticks to the top of the viewport
              once the user scrolls past the heading, sitting just above the
              MenuList sticky category bar (which adjusts its sticky top to
              compensate). Desktop renders the search in CustomerTopNav. */}
          <div className="sticky top-0 z-30 -mx-5 px-5 pt-2 pb-2 bg-qf-bg/95 backdrop-blur mb-2 lg:hidden">
            <div className="bg-white rounded-full flex items-center gap-2.5 px-5 h-11 border border-qf-line focus-within:ring-2 focus-within:ring-(--qf-primary)">
              <IcoSearch c="#7c8a82" s={18} />
              <input
                ref={menuSearchRef}
                type="search"
                value={menuQuery}
                onChange={(e) => setMenuQuery(e.target.value)}
                placeholder="חיפוש בתפריט"
                className="flex-1 bg-transparent outline-none text-[15px] text-qf-ink placeholder:text-qf-mute"
              />
              {menuQuery && (
                <button
                  type="button"
                  onClick={() => setMenuQuery("")}
                  className="text-xs text-qf-mute hover:text-qf-ink shrink-0"
                  aria-label="נקה חיפוש"
                >
                  נקה
                </button>
              )}
            </div>
          </div>
          <div className="-mx-5 lg:mx-0">
            <MenuList
              tenantSlug={tenant.slug}
              businessType={tenant.businessType}
              categories={allCategories}
              items={menuItems}
              query={menuQuery}
              activeTags={activeTags}
              showTagFilter
              onToggleTag={toggleTag}
              onClearTags={() => setActiveTags(new Set())}
              noticesByCategory={noticesByCategory}
              noticesByItem={noticesByItem}
              scrollOffset={120}
            />
          </div>
        </section>
      )}

      <BottomTabBar tenantSlug={tenant.slug} />
      <CampaignPopup tenantSlug={tenant.slug} />

      {pickerOpen && (
        <CityPickerModal
          tenantName={tenant.name}
          coverImage={tenant.coverImage ?? null}
          cities={deliveryCities}
          pickupEnabled={pickupEnabled}
          branchAddress={branch?.address ?? null}
          required={pickerRequired}
          initialMethod={
            !pickupEnabled
              ? "delivery"
              : method === "pickup" || deliveryCities.length === 0
                ? "pickup"
                : "delivery"
          }
          onChoose={applyChoice}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
