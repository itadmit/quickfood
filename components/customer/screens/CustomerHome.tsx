"use client";

import Link from "next/link";
import { IcoPin, IcoSearch, IcoChevDown, IcoStar, IcoClock, IcoBike, IcoFlame } from "@/components/shared/Icons";
import { PizzaArt } from "@/components/customer/PizzaArt";
import { BottomTabBar } from "@/components/customer/BottomTabBar";
import { useCart } from "@/components/customer/CartProvider";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";

interface Props {
  tenant: {
    id: string;
    slug: string;
    name: string;
    logoLetter: string;
    cuisineType: string | null;
  };
  branch: {
    address: string;
    status: string;
    deliveryFee: number;
    minOrder: number;
  } | null;
  categories: Array<{ id: string; name: string; icon: string | null }>;
  popular: Array<{
    id: string;
    name: string;
    description: string;
    basePrice: number;
    artType: string | null;
  }>;
  children?: React.ReactNode;
}

export function CustomerHome({ tenant, branch, categories, popular, children }: Props) {
  const { method, setMethod } = useCart();
  const open = branch?.status === "open";

  return (
    <div className="pb-24">
      {/* Header gradient */}
      <header className="bg-gradient-to-b from-(--qf-primary) to-(--qf-deep) text-white px-5 pt-5 pb-7 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-full text-sm transition"
          >
            <IcoPin c="#fff" s={14} />
            <span className="truncate max-w-[180px]">{branch?.address ?? "בחר כתובת"}</span>
            <IcoChevDown c="#fff" s={12} />
          </button>
          <Link
            href={`/${tenant.slug}/profile`}
            className="w-9 h-9 rounded-full bg-white text-(--qf-deep) grid place-items-center font-bold text-sm"
          >
            ?
          </Link>
        </div>

        {/* Delivery / Pickup tabs */}
        <div className="bg-white/15 rounded-2xl p-1 grid grid-cols-2 mb-4">
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
      </header>

      {/* Hero promo */}
      <section className="px-5 -mt-3">
        <Link
          href={`/${tenant.slug}/menu`}
          className="block rounded-2xl bg-qf-warm border border-qf-line p-4 flex items-center gap-3 shadow-sm"
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

      {/* Categories scroll */}
      <section className="px-5 mt-5">
        <h2 className="text-base font-semibold mb-2">קטגוריות</h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-5 px-5">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/${tenant.slug}/menu#cat-${c.id}`}
              className="shrink-0 bg-white rounded-2xl border border-qf-line px-4 py-3 min-w-[88px] text-center"
            >
              <div className="w-10 h-10 rounded-full bg-qf-green-soft grid place-items-center mx-auto mb-1">
                <IcoFlame c="var(--qf-primary)" s={20} />
              </div>
              <div className="text-xs font-medium">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Restaurant card */}
      <section className="px-5 mt-5">
        <Link
          href={`/${tenant.slug}/menu`}
          className="block rounded-3xl overflow-hidden border border-qf-line bg-white shadow-sm"
        >
          <div className="relative h-32 bg-gradient-to-br from-(--qf-primary) to-(--qf-deep)">
            <div className="absolute -bottom-5 end-5 opacity-90">
              <PizzaArt size={90} type="margherita" />
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold leading-tight">{tenant.name}</h3>
                <div className="text-xs text-qf-mute mt-0.5">{tenant.cuisineType}</div>
                <div className="text-xs text-qf-mute">{branch?.address}</div>
              </div>
              <div className="flex items-center gap-1 bg-qf-green-soft text-qf-green-deep px-2 py-1 rounded-md text-xs font-medium">
                <IcoStar c="var(--qf-primary)" s={12} fill="var(--qf-primary)" />
                <span className="tnum">4.8</span>
              </div>
            </div>
            <div className="flex gap-3 mt-3 text-xs">
              <Chip>
                <IcoClock s={12} />
                <span>25–35 דק&apos;</span>
              </Chip>
              <Chip>
                <IcoBike s={12} />
                <span>{branch ? formatPrice(branch.deliveryFee) : "—"}</span>
              </Chip>
              <Chip
                className={cn(
                  open
                    ? "bg-qf-green-soft text-qf-green-deep border-qf-green-line"
                    : "bg-qf-tomato-soft text-qf-tomato border-qf-tomato/40",
                )}
              >
                {open ? "פתוח עכשיו" : "סגור"}
              </Chip>
            </div>
          </div>
        </Link>
      </section>

      {/* Popular items */}
      {popular.length > 0 && (
        <section className="px-5 mt-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">פופולריים</h2>
            <Link href={`/${tenant.slug}/menu`} className="text-xs text-(--qf-deep)">
              לכל התפריט ←
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-2">
            {popular.map((item) => (
              <Link
                key={item.id}
                href={`/${tenant.slug}/menu/${item.id}`}
                className="shrink-0 w-44 bg-white rounded-2xl border border-qf-line overflow-hidden"
              >
                <div className="aspect-square bg-qf-warm grid place-items-center">
                  <PizzaArt size={120} type={item.artType ?? "margherita"} />
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
    </div>
  );
}

function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 bg-qf-line-soft border border-qf-line px-2 py-1 rounded-md",
        className,
      )}
    >
      {children}
    </span>
  );
}
