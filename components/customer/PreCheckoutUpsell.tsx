"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/customer/CartProvider";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { ItemDetailModal } from "@/components/customer/ItemDetailModal";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";
import ItemModalSkeleton from "@/components/customer/ItemModalSkeleton";
import { IcoCheck, IcoPlus } from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";

interface UpsellItem {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  needsConfig?: boolean;
}

function shownKey(tenantSlug: string) {
  return `qf:pre-checkout-upsell:${tenantSlug}`;
}

/**
 * The storefront half of the category-level "תזכורת לפני סגירת ההזמנה"
 * flag (upsellBeforeCheckout) - the kiosk has its own copy. Tapping
 * המשך לתשלום fires a one-shot "anything else?" sheet with up to 4 items
 * from the flagged categories; skip or add once and it stays out of the
 * way for the rest of the session.
 *
 * Returns an interceptor for the checkout buttons plus the sheet element
 * the cart screen renders.
 */
export function usePreCheckoutUpsell(tenantSlug: string) {
  const { lines, tenant, add } = useCart();
  const [items, setItems] = useState<UpsellItem[]>([]);
  const [open, setOpen] = useState(false);
  const [pickItemId, setPickItemId] = useState<string | null>(null);
  const [itemData, setItemData] = useState<null | {
    item: Record<string, unknown>;
    tenant: { slug: string; businessType: string };
  }>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ctrl = new AbortController();
    const excludeIds = Array.from(new Set(lines.map((l) => l.itemId))).join(",");
    const params = new URLSearchParams({ tenant: tenantSlug, flag: "checkout" });
    if (excludeIds) params.set("exclude", excludeIds);
    fetch(`/api/v1/customer/cart-upsell?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: { items?: UpsellItem[] }) => setItems(data.items ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [tenantSlug, lines]);

  useEffect(() => {
    if (!pickItemId) {
      setItemData(null);
      return;
    }
    setItemLoading(true);
    const ctrl = new AbortController();
    fetch(`/api/v1/customer/menu-item?slug=${tenantSlug}&id=${encodeURIComponent(pickItemId)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.item) setItemData(d);
      })
      .catch(() => {})
      .finally(() => setItemLoading(false));
    return () => ctrl.abort();
  }, [pickItemId, tenantSlug]);

  const [continueFn, setContinueFn] = useState<(() => void) | null>(null);

  /** Call instead of navigating; runs `next` immediately when there's
   *  nothing to offer or the sheet already fired this session. */
  function intercept(next: () => void): void {
    let shown = false;
    try {
      shown = window.sessionStorage.getItem(shownKey(tenantSlug)) === "1";
    } catch {
      /* blocked storage - fall through to showing once per mount */
    }
    if (shown || items.length === 0) {
      next();
      return;
    }
    try {
      window.sessionStorage.setItem(shownKey(tenantSlug), "1");
    } catch {
      /* ignore */
    }
    setContinueFn(() => next);
    setOpen(true);
  }

  function quickAdd(it: UpsellItem) {
    if (it.needsConfig) {
      setPickItemId(it.id);
      return;
    }
    add({
      itemId: it.id,
      name: it.name,
      basePrice: it.basePrice,
      artType: null,
      imageUrl: it.imageUrl,
      quantity: 1,
      sizeId: null,
      sizeName: null,
      sizeDelta: 0,
      options: [],
      notes: null,
      source: "upsell",
    });
    setAddedIds((prev) => new Set(prev).add(it.id));
  }

  const businessType = (tenant.businessType as BusinessType) ?? "general";
  const upsellTitle =
    tenant.preCheckoutUpsellTitle?.trim() || "להוסיף משהו לפני שמסיימים?";
  const upsellSubtitle =
    tenant.preCheckoutUpsellSubtitle?.trim() || "ההמלצה האחרונה שלנו לסגירת הארוחה";

  const element = (
    <>
      {/* Hidden (not unmounted) while the item-config modal is up so the
          sheet - one z-layer above regular modals - doesn't cover it. */}
      {open && !pickItemId && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] animate-qf-sheet-in">
            <header className="px-5 py-4 border-b border-qf-line-soft text-center">
              <h2 className="text-lg font-bold text-qf-ink">{upsellTitle}</h2>
              <p className="text-xs text-qf-mute mt-0.5">{upsellSubtitle}</p>
            </header>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                {items.map((it) => {
                  const justAdded = addedIds.has(it.id);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => quickAdd(it)}
                      className="relative bg-white border border-qf-line rounded-2xl overflow-hidden text-right hover:border-(--qf-primary)/40 hover:shadow-sm transition active:scale-[0.98]"
                    >
                      <div className="aspect-square bg-qf-line-soft relative">
                        <MenuItemImage
                          src={it.imageUrl ?? undefined}
                          alt={it.name}
                          businessType={businessType}
                          size={200}
                          rounded="none"
                          fill
                        />
                      </div>
                      <div className="p-2.5">
                        <div className="text-sm font-bold leading-tight line-clamp-2 min-h-[2.4em]">
                          {it.name}
                        </div>
                        <div className="text-xs text-qf-mute tnum mt-1">
                          {formatPrice(it.basePrice)}
                        </div>
                      </div>
                      <span className="absolute top-2 start-2 w-8 h-8 rounded-full bg-white shadow-md grid place-items-center">
                        {justAdded ? (
                          <IcoCheck c="#0e7a3c" s={14} className="animate-qf-check-in" />
                        ) : (
                          <IcoPlus c="#11231a" s={14} />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <footer className="px-4 py-3 border-t border-qf-line-soft grid grid-cols-2 gap-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-12 rounded-2xl border border-qf-line hover:bg-qf-line-soft text-qf-ink2 text-sm font-bold transition"
              >
                חזרה לסל
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  continueFn?.();
                }}
                className="h-12 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-bold shadow-sm shadow-(--qf-primary)/25 active:scale-[0.98] transition"
              >
                המשך לתשלום
              </button>
            </footer>
          </div>
        </div>
      )}

      {pickItemId && (
        <ItemDetailModal onClose={() => setPickItemId(null)}>
          {itemLoading || !itemData ? (
            <ItemModalSkeleton />
          ) : (
            <ItemDetail
              tenantSlug={tenantSlug}
              businessType={(itemData.tenant as { businessType: string }).businessType as never}
              item={itemData.item as never}
              inModal
              onClose={() => setPickItemId(null)}
              addSource="upsell"
            />
          )}
        </ItemDetailModal>
      )}
    </>
  );

  return { intercept, element };
}
