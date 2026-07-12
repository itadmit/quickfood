"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IcoChev, IcoPlus, IcoMinus, IcoBag, IcoClose, IcoArrowLeft } from "@/components/shared/Icons";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { BottomTabBar } from "@/components/customer/BottomTabBar";
import { useCart, type CartLine } from "@/components/customer/CartProvider";
import { CartLineOptions } from "@/components/customer/CartLineOptions";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/shared/Skeleton";
import { ItemDetailModal } from "@/components/customer/ItemDetailModal";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";
import ItemModalSkeleton from "@/components/customer/ItemModalSkeleton";
import { CartUpsell } from "@/components/customer/CartUpsell";
import { CartBundleOffers } from "@/components/customer/CartBundleOffers";

export function CustomerCart({ tenantSlug }: { tenantSlug: string }) {
  const router = useRouter();
  const { lines, updateQuantity, remove, subtotal, method, deliveryFee, branch, tenant, hydrated, bundleDiscount } = useCart();

  // Wolt-style: clicking a cart line opens the item-detail modal in
  // edit mode (pre-filled with the line's selections; CTA flips to
  // "עדכן הזמנה"). We fetch the menu item by its current itemId so the
  // available options reflect the live menu, not a stale snapshot.
  const [editing, setEditing] = useState<CartLine | null>(null);
  const [editItem, setEditItem] = useState<null | { item: Record<string, unknown>; tenant: { slug: string; businessType: string } }>(null);
  const [editLoading, setEditLoading] = useState(false);
  useEffect(() => {
    if (!editing) {
      setEditItem(null);
      return;
    }
    setEditLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/v1/customer/menu-item?slug=${tenantSlug}&id=${encodeURIComponent(editing.itemId)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { if (d.item) setEditItem(d); })
      .catch(() => {})
      .finally(() => setEditLoading(false));
    return () => ctrl.abort();
  }, [editing, tenantSlug]);

  const serviceFee = branch?.serviceFee ?? 0;
  const total = Math.max(0, subtotal + deliveryFee + serviceFee - bundleDiscount);
  const minOrder = branch?.minOrder ?? 0;
  const meetsMin = subtotal >= minOrder;

  // Until the cart finishes reading from localStorage on mount, `lines`
  // is transiently empty. Suppress the "הסל ריק" empty state to avoid
  // a flash on full-page loads (most visible on desktop refresh).
  if (!hydrated) {
    return <CartLinesSkeleton tenantSlug={tenantSlug} />;
  }

  if (lines.length === 0) {
    return (
      <div className="min-h-screen flex flex-col pb-24">
        <header className="px-5 pt-5 pb-3 flex items-center gap-3">
          <Link
            href={`/s/${tenantSlug}`}
            className="w-9 h-9 rounded-full bg-white border border-qf-line grid place-items-center"
            aria-label="חזרה"
          >
            <IcoChev s={18} />
          </Link>
          <h1 className="font-bold text-lg">הסל שלי</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-20 h-20 rounded-full bg-(--qf-soft) grid place-items-center mb-4">
            <IcoBag c="var(--qf-primary)" s={36} />
          </div>
          <h2 className="font-semibold text-lg mb-1">הסל ריק</h2>
          <p className="text-sm text-qf-mute mb-5">הוסף פריטים מהתפריט וחזור הנה לסיום ההזמנה</p>
          <Link
            href={`/s/${tenantSlug}`}
            className="px-5 py-3 rounded-full bg-(--qf-primary) text-white font-medium text-sm"
          >
            לתפריט
          </Link>
        </div>
        <BottomTabBar tenantSlug={tenantSlug} />
      </div>
    );
  }

  return (
    <div className="pb-44 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:px-6 lg:mt-6">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line sticky top-0 z-10 lg:bg-transparent lg:border-0 lg:px-0 lg:pt-0 lg:pb-6 lg:static">
        <Link
          href={`/s/${tenantSlug}`}
          className="w-9 h-9 rounded-full border border-qf-line grid place-items-center lg:hidden"
          aria-label="חזרה"
        >
          <IcoChev s={18} />
        </Link>
        <h1 className="font-bold text-lg lg:text-3xl">הסל שלי</h1>
        <span className="text-xs text-qf-mute lg:text-base">· {tenant.name}</span>
      </header>

      {/* Desktop = 2-col: lines on the left (wider), summary + CTA in a sticky sidebar on the right. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0">
      {/* Lines */}
      <div className="px-5 mt-3 space-y-2.5 lg:px-0 lg:mt-0">
        {lines.map((l) => {
          const opts = l.options.reduce((a, o) => a + o.priceDelta, 0);
          const unit = l.basePrice + l.sizeDelta + opts;
          const lineTotal = unit * l.quantity;
          return (
            <div
              key={l.lineId}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!l.deal) setEditing(l);
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !l.deal) {
                  e.preventDefault();
                  setEditing(l);
                }
              }}
              className="bg-white rounded-2xl border border-qf-line p-3.5 flex gap-3.5 shadow-xs cursor-pointer hover:border-black/40 transition"
            >
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0">
                <MenuItemImage
                  src={l.imageUrl}
                  alt={l.name}
                  businessType={(tenant.businessType as BusinessType) ?? "general"}
                  size={80}
                  rounded="xl"
                  className="w-full h-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold leading-tight">{l.name}</div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(l.lineId);
                    }}
                    className="w-8 h-8 rounded-full text-qf-mute hover:text-qf-tomato hover:bg-qf-tomato-soft grid place-items-center -m-1 shrink-0 transition"
                    aria-label="הסר"
                  >
                    <IcoClose s={16} c="currentColor" />
                  </button>
                </div>
                {l.sizeName && (
                  <div className="text-xs text-qf-mute mt-0.5">{l.sizeName}</div>
                )}
                <CartLineOptions options={l.options} />
                {l.notes && (
                  <div className="text-xs text-qf-ink2 mt-0.5">הערה: {l.notes}</div>
                )}
                <div className="flex items-center justify-between mt-2.5">
                  <div
                    className="flex items-center bg-qf-bg rounded-full border border-qf-line"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => updateQuantity(l.lineId, l.quantity - 1)}
                      className="w-9 h-9 grid place-items-center active:bg-qf-line-soft rounded-full transition"
                      aria-label="הפחת"
                    >
                      <IcoMinus s={16} />
                    </button>
                    <div className="w-7 text-center text-base font-bold tnum">{l.quantity}</div>
                    <button
                      type="button"
                      onClick={() => updateQuantity(l.lineId, l.quantity + 1)}
                      className="w-9 h-9 grid place-items-center active:bg-qf-line-soft rounded-full transition"
                      aria-label="הוסף"
                    >
                      <IcoPlus c="#11231a" s={16} />
                    </button>
                  </div>
                  <div className="font-bold tnum text-base">{formatPrice(lineTotal)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

          <CartBundleOffers
            businessType={(tenant.businessType as BusinessType) ?? "general"}
          />

          <CartUpsell tenantSlug={tenantSlug} />
        </div>

        {/* Summary + CTA - inline card on mobile, sticky sidebar on desktop. */}
        <aside className="px-5 mt-5 lg:px-0 lg:mt-0 lg:sticky lg:top-20 lg:self-start">
          <div className="bg-white border border-qf-line rounded-2xl p-4 space-y-2 text-sm shadow-xs">
            <Row label="סכום ביניים" value={formatPrice(subtotal)} />
            {bundleDiscount > 0 && (
              <Row label="הנחת מבצע" value={`-${formatPrice(bundleDiscount)}`} />
            )}
            {method === "delivery" && (
              <Row label="דמי משלוח" value={deliveryFee === 0 ? "חינם" : formatPrice(deliveryFee)} />
            )}
            {serviceFee > 0 && <Row label="דמי שירות" value={formatPrice(serviceFee)} />}
            <div className="border-t border-qf-line-soft pt-2 mt-2">
              <Row bold label="סה״כ" value={formatPrice(total)} />
            </div>

            {/* Desktop CTA lives inside the summary card. Mobile keeps the fixed pill below. */}
            <div className="hidden lg:block pt-3 mt-2 border-t border-qf-line-soft">
              {!meetsMin && (
                <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-xs text-qf-ink2 mb-2">
                  חסר {formatPrice(minOrder - subtotal)} לסכום מינימום ({formatPrice(minOrder)})
                </div>
              )}
              <button
                type="button"
                disabled={!meetsMin}
                onClick={() => {
                  // Belt-and-suspenders: scroll to top BEFORE the route change
                  // so the user sees the new screen open from the top even on
                  // mobile Safari where streaming/layout shifts can race the
                  // global ScrollToTop.
                  window.scrollTo(0, 0);
                  router.push(`/s/${tenantSlug}/checkout`);
                }}
                className="w-full bg-(--qf-primary) hover:bg-(--qf-deep) disabled:bg-qf-mute disabled:shadow-none text-white rounded-2xl px-5 h-14 text-base font-semibold flex items-center justify-between shadow-sm shadow-(--qf-primary)/25 transition"
              >
                <span className="inline-flex items-center gap-2">
                  <span>המשך לתשלום</span>
                  <IcoArrowLeft c="#fff" s={16} />
                </span>
                <span className="tnum text-lg">{formatPrice(total)}</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Footer CTA - mobile only (desktop uses the sidebar above). */}
      <div className="lg:hidden fixed bottom-20 inset-x-0 z-30 max-w-md mx-auto px-4">
        {!meetsMin && (
          <div className="bg-qf-yolk-soft border border-qf-yolk/40 rounded-xl px-3 py-2 text-xs text-qf-ink2 mb-2">
            חסר {formatPrice(minOrder - subtotal)} לסכום מינימום ({formatPrice(minOrder)})
          </div>
        )}
        <button
          type="button"
          disabled={!meetsMin}
          onClick={() => router.push(`/s/${tenantSlug}/checkout`)}
          className="w-full bg-(--qf-primary) hover:bg-(--qf-deep) disabled:bg-qf-mute disabled:shadow-none text-white rounded-2xl px-5 h-16 text-base font-semibold flex items-center justify-between shadow-lg shadow-(--qf-primary)/25 transition active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-2">
            <span>המשך לתשלום</span>
            <IcoArrowLeft c="#fff" s={16} />
          </span>
          <span className="tnum text-lg">{formatPrice(total)}</span>
        </button>
      </div>

      <BottomTabBar tenantSlug={tenantSlug} />

      {editing && (
        <ItemDetailModal onClose={() => setEditing(null)}>
          {editLoading || !editItem ? (
            <ItemModalSkeleton />
          ) : (
            <ItemDetail
              tenantSlug={tenantSlug}
              businessType={(editItem.tenant as { businessType: string }).businessType as never}
              item={editItem.item as never}
              inModal
              editLine={editing}
              onClose={() => setEditing(null)}
            />
          )}
        </ItemDetailModal>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className={bold ? "font-semibold" : "text-qf-ink2"}>{label}</div>
      <div className={bold ? "font-bold tnum text-base" : "tnum"}>{value}</div>
    </div>
  );
}

/** Lightweight skeleton shown while the cart hydrates from localStorage,
 * so refreshing the cart page never flashes the "הסל ריק" empty state.
 * Layout mirrors the loaded cart at both mobile and lg+ breakpoints. */
function CartLinesSkeleton({ tenantSlug }: { tenantSlug: string }) {
  return (
    <div className="pb-44 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:px-6 lg:mt-6">
      <header className="px-5 pt-5 pb-3 flex items-center gap-3 bg-white border-b border-qf-line sticky top-0 z-10 lg:bg-transparent lg:border-0 lg:px-0 lg:pt-0 lg:pb-6 lg:static">
        <Skeleton className="w-9 h-9 rounded-full lg:hidden" />
        <Skeleton className="h-5 w-24 lg:h-8 lg:w-40" />
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
        <div className="min-w-0">
          <div className="px-5 mt-3 space-y-2.5 lg:px-0 lg:mt-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-qf-line p-3.5 flex gap-3.5 shadow-xs"
              >
                <Skeleton className="w-20 h-20 rounded-xl" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-1/3" />
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-9 w-28 rounded-full" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="px-5 mt-5 lg:px-0 lg:mt-0 lg:sticky lg:top-20 lg:self-start">
          <div className="bg-white border border-qf-line rounded-2xl p-4 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="border-t border-qf-line-soft pt-2 mt-2 flex items-center justify-between">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="hidden lg:block pt-3 mt-2 border-t border-qf-line-soft">
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          </div>
        </aside>
      </div>

      <div className="lg:hidden fixed bottom-20 inset-x-0 z-30 max-w-md mx-auto px-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>

      <BottomTabBar tenantSlug={tenantSlug} />
    </div>
  );
}
