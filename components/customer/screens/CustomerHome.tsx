"use client";

import Link from "next/link";
import { IcoPin, IcoSearch, IcoChevDown, IcoStar, IcoClock, IcoBike, IcoFlame, IcoUser, IcoArrowLeft } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { BottomTabBar } from "@/components/customer/BottomTabBar";
import { CampaignPopup } from "@/components/customer/CampaignPopup";
import { resolveCategoryStyle } from "@/lib/category-style";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { SmartImg } from "@/components/shared/SmartImg";
import { cn } from "@/lib/cn";

interface Props {
  tenant: {
    id: string;
    slug: string;
    name: string;
    logoLetter: string;
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
  lastOrder?: {
    id: string;
    number: string;
    total: number;
    status: string;
    createdAt: string;
    itemCount: number;
    headlineItem: string | null;
    headlineImage: string | null;
  } | null;
  children?: React.ReactNode;
}

export function CustomerHome({ tenant, branch, categories, popular, lastOrder, children }: Props) {
  const { method, setMethod } = useCart();
  const open = branch?.status === "open";

  const hasCover = Boolean(tenant.coverImage);

  return (
    <div className="pb-20">
      {/* Unified hero: cover image (if any) replaces the green background. */}
      <header className="relative text-white px-5 pt-5 pb-12 overflow-hidden isolate rounded-b-3xl">
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

        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-1.5 rounded-full text-sm transition"
          >
            <IcoPin c="#fff" s={14} />
            <span className="truncate max-w-[180px]">{branch?.address ?? "בחר כתובת"}</span>
            <IcoChevDown c="#fff" s={12} />
          </button>
          <Link
            href={`/${tenant.slug}/profile`}
            aria-label="אזור אישי"
            className="w-9 h-9 rounded-full bg-white grid place-items-center"
          >
            <IcoUser c="var(--qf-deep)" s={18} />
          </Link>
        </div>

        {/* Delivery / Pickup tabs */}
        <div className="bg-white/20 backdrop-blur rounded-2xl p-1 grid grid-cols-2 mb-4">
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
          className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-full text-qf-mute text-sm"
        >
          <IcoSearch c="#7c8a82" s={16} />
          <span>חיפוש בתפריט</span>
        </Link>

        {/* Tenant name (merged from former cover section) */}
        <div className="mt-6">
          <h1 className="text-2xl font-bold leading-tight drop-shadow-md">{tenant.name}</h1>
          {tenant.cuisineType && (
            <div className="text-sm text-white/90 drop-shadow">{tenant.cuisineType}</div>
          )}
        </div>
      </header>

      {/* Thin info bar — pulled up so it sits visibly on top of the hero,
          straddling the cover image and the body. */}
      <section className="px-5 -mt-10 relative z-10">
        <div className="bg-white border border-qf-line rounded-full shadow-sm px-3 py-2 flex items-center justify-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold">
            <IcoStar c="var(--qf-primary)" s={12} fill="var(--qf-primary)" />
            <span className="tnum">4.8</span>
          </span>
          <span className="text-qf-line">·</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium",
              open ? "text-qf-green-deep" : "text-qf-tomato",
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", open ? "bg-qf-green-deep" : "bg-qf-tomato")} />
            {open ? "פתוח" : "סגור"}
          </span>
          <span className="text-qf-line">·</span>
          <span className="inline-flex items-center gap-1 text-qf-ink2">
            <IcoClock s={11} c="#7c8a82" />
            <span>25–35 דק&apos;</span>
          </span>
          <span className="text-qf-line">·</span>
          <span className="inline-flex items-center gap-1 text-qf-ink2">
            <IcoBike s={12} c="#7c8a82" />
            <span>{branch ? formatPrice(branch.deliveryFee) : "—"}</span>
          </span>
        </div>
      </section>

      {/* Hero promo */}
      <section className="px-5 mt-3">
        <Link
          href={`/${tenant.slug}/menu`}
          className="rounded-2xl bg-qf-warm border border-qf-line p-4 flex items-center gap-3 shadow-sm"
        >
          <div className="bg-qf-tomato/10 rounded-xl p-3">
            <IcoFlame c="#c2421f" s={28} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium text-qf-tomato">שעת הבצק</div>
            <div className="font-semibold leading-tight">1+1 על קלאסיות</div>
            <div className="text-xs text-qf-ink2">כל יום 14:00–17:00</div>
          </div>
        </Link>
      </section>

      {/* Last order */}
      {lastOrder && (
        <section className="px-5 mt-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">ההזמנה האחרונה שלך</h2>
            <Link href={`/${tenant.slug}/profile`} className="text-xs text-(--qf-deep) inline-flex items-center gap-1">
              כל ההזמנות
              <IcoArrowLeft c="currentColor" s={12} />
            </Link>
          </div>
          <Link
            href={`/${tenant.slug}/orders/${lastOrder.id}`}
            className="rounded-2xl bg-white border border-qf-line p-3 flex items-center gap-3 shadow-sm"
          >
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
              <MenuItemImage
                src={lastOrder.headlineImage ?? undefined}
                alt={lastOrder.headlineItem ?? tenant.name}
                businessType={tenant.businessType ?? "general"}
                size={64}
                rounded="md"
                className="w-full h-full"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm leading-tight truncate">
                {lastOrder.headlineItem ?? "הזמנה"}
                {lastOrder.itemCount > 1 ? ` +${lastOrder.itemCount - 1}` : ""}
              </div>
              <div className="text-xs text-qf-mute mt-0.5">
                <RelativeTime date={lastOrder.createdAt} /> · <span className="tnum">{formatPrice(lastOrder.total)}</span>
              </div>
            </div>
            <span className="bg-(--qf-primary) text-white text-xs font-semibold px-3 py-2 rounded-full shrink-0">
              הזמן שוב
            </span>
          </Link>
        </section>
      )}

      {/* Categories scroll */}
      <section className="px-5 mt-5">
        <h2 className="text-base font-semibold mb-2">קטגוריות</h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
          {categories.map((c) => {
            const style = resolveCategoryStyle(c.icon, c.color);
            const Icon = style.Icon;
            return (
              <Link
                key={c.id}
                href={`/${tenant.slug}/menu#cat-${c.id}`}
                className="shrink-0 bg-white rounded-2xl border border-qf-line px-4 py-3 min-w-[88px] text-center"
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

      {/* Popular items */}
      {popular.length > 0 && (
        <section className="px-5 mt-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">פופולריים</h2>
            <Link href={`/${tenant.slug}/menu`} className="text-xs text-(--qf-deep) inline-flex items-center gap-1">
              לכל התפריט
              <IcoArrowLeft c="currentColor" s={12} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2">
            {popular.map((item) => (
              <Link
                key={item.id}
                href={`/${tenant.slug}/menu/${item.id}`}
                className="shrink-0 w-44 bg-white rounded-2xl border border-qf-line overflow-hidden"
              >
                <div className="aspect-square overflow-hidden">
                  <MenuItemImage
                    src={item.images?.[0]}
                    alt={item.name}
                    businessType={tenant.businessType ?? "general"}
                    size={176}
                    rounded="md"
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
