"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/customer/CartProvider";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { ItemDetailModal } from "@/components/customer/ItemDetailModal";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";
import ItemModalSkeleton from "@/components/customer/ItemModalSkeleton";
import { IcoPlus } from "@/components/shared/Icons";
import { formatPrice } from "@/lib/format";

interface UpsellItem {
  id: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
}

export function CartUpsell({ tenantSlug }: { tenantSlug: string }) {
  const { lines, tenant } = useCart();
  const [items, setItems] = useState<UpsellItem[]>([]);
  const [heading, setHeading] = useState<string>("מומלץ עבורך");
  const [pickItemId, setPickItemId] = useState<string | null>(null);
  const [itemData, setItemData] = useState<null | { item: Record<string, unknown>; tenant: { slug: string; businessType: string } }>(null);
  const [itemLoading, setItemLoading] = useState(false);

  // Fetch the upsell list, excluding what's already in the cart so we
  // never recommend a duplicate. Re-runs whenever the cart contents
  // change so a freshly added drink falls off the carousel.
  useEffect(() => {
    const ctrl = new AbortController();
    const excludeIds = Array.from(new Set(lines.map((l) => l.itemId))).join(",");
    const params = new URLSearchParams({ tenant: tenantSlug });
    if (excludeIds) params.set("exclude", excludeIds);
    fetch(`/api/v1/customer/cart-upsell?${params.toString()}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: { items?: UpsellItem[]; heading?: string }) => {
        setItems(data.items ?? []);
        if (data.heading) setHeading(data.heading);
      })
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
    fetch(`/api/v1/customer/menu-item?slug=${tenantSlug}&id=${encodeURIComponent(pickItemId)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { if (d.item) setItemData(d); })
      .catch(() => {})
      .finally(() => setItemLoading(false));
    return () => ctrl.abort();
  }, [pickItemId, tenantSlug]);

  if (items.length === 0) return null;

  const businessType = (tenant.businessType as BusinessType) ?? "general";

  return (
    <section className="mt-6 px-5 lg:px-0">
      <h2 className="text-base font-bold mb-3">{heading}</h2>
      <div className="-mx-5 px-5 lg:mx-0 lg:px-0 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 pb-2 snap-x snap-mandatory">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setPickItemId(it.id)}
              className="snap-start shrink-0 w-40 bg-white border border-qf-line rounded-2xl overflow-hidden text-right hover:border-black/40 transition relative"
            >
              <div className="aspect-square bg-qf-line-soft relative">
                <MenuItemImage
                  src={it.imageUrl ?? undefined}
                  alt={it.name}
                  businessType={businessType}
                  size={160}
                  rounded="none"
                  fill
                />
                <span
                  aria-hidden
                  className="absolute top-2 start-2 w-8 h-8 rounded-full bg-white shadow-md grid place-items-center"
                >
                  <IcoPlus c="#11231a" s={16} />
                </span>
              </div>
              <div className="p-2.5">
                <div className="text-sm font-bold leading-tight line-clamp-2 min-h-[2.5em]">{it.name}</div>
                <div className="text-xs text-qf-mute mt-1 tnum">{formatPrice(it.basePrice)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

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
    </section>
  );
}
