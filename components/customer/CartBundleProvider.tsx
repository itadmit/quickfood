"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { ItemDetailModal } from "@/components/customer/ItemDetailModal";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";
import ItemModalSkeleton from "@/components/customer/ItemModalSkeleton";
import { IcoClose } from "@/components/shared/Icons";
import { useCart } from "@/components/customer/CartProvider";

export interface BundleSuggestion {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  mode: "linked" | "legacy";
  bundle_price: number;
  full_price: number;
  savings: number;
  linked_item?: {
    id: string;
    name: string;
    base_price: number;
    image_url: string | null;
  };
  addons?: Array<{
    item_id: string;
    name: string;
    base_price: number;
    image_url: string | null;
    qty: number;
  }>;
  /** Trigger items present in the cart that this offer matched - the
   *  lines we swap out when a linked combo is accepted. */
  trigger_item_ids: string[];
}

interface BundleContextValue {
  /** Active offers that fire on the current cart, minus accepted ones. */
  offers: BundleSuggestion[];
  /** Accept an offer: legacy injects its addons, linked opens the combo's
   *  ItemDetail to configure (then swaps the trigger lines out). */
  accept: (offer: BundleSuggestion) => void;
}

const BundleContext = createContext<BundleContextValue | null>(null);

/** Cart-page inline offer cards read the shared offer list + accept handler
 *  from here so they share the provider's single fetch + linked-combo modal. */
export function useBundleOffers(): BundleContextValue {
  return useContext(BundleContext) ?? { offers: [], accept: () => {} };
}

/**
 * Global bundle ("מבצע") orchestrator, mounted once in the customer layout
 * so an offer can pop the moment a trigger item lands in the cart - from
 * the menu, the item modal, anywhere - not only on the cart screen.
 *
 * Owns: the /cart-bundles fetch, the auto-pop modal (suppressed on the cart
 * screen, which shows inline cards instead, and on pay/kiosk surfaces), and
 * the accept flow. Accepted ids live in CartProvider so checkout submits
 * them as applied_bundle_ids.
 */
export function CartBundleProvider({
  tenantSlug,
  businessType,
  children,
}: {
  tenantSlug: string;
  businessType: BusinessType;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const { lines, add, remove, acceptedBundles, acceptBundle, unacceptBundle } = useCart();

  const [suggestions, setSuggestions] = useState<BundleSuggestion[]>([]);
  const [popup, setPopup] = useState<BundleSuggestion | null>(null);
  const shownPopupIds = useRef<Set<string>>(new Set());

  const [linkedConfig, setLinkedConfig] = useState<null | { item: Record<string, unknown>; tenant: { slug: string; businessType: string } }>(null);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const [pendingSwap, setPendingSwap] = useState<null | {
    bundleId: string;
    linkedItemId: string;
    triggerItemIds: string[];
    baselineCount: number;
    savings: number;
  }>(null);

  const acceptedIds = new Set(acceptedBundles.map((b) => b.id));

  // The modal pops everywhere EXCEPT the cart screen (inline cards there)
  // and the focused pay/kiosk surfaces.
  const popupAllowed =
    !/\/s\/[^/]+\/(cart|checkout|pay(-checkout)?|kiosk)(\/|$)/.test(pathname);

  // Fetch matching offers whenever the cart contents change.
  useEffect(() => {
    if (lines.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const itemIds = Array.from(new Set(lines.map((l) => l.itemId))).join(",");
    fetch(
      `/api/v1/customer/cart-bundles?tenant=${encodeURIComponent(tenantSlug)}&items=${itemIds}`,
      { signal: ctrl.signal },
    )
      .then((r) => (r.ok ? r.json() : { bundles: [] }))
      .then((d: { bundles?: BundleSuggestion[] }) => setSuggestions(d.bundles ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [lines, tenantSlug]);

  // Reconcile: an accepted bundle that re-appears as a suggestion is no
  // longer satisfied (an addon was removed) - un-accept so the displayed
  // total matches what the server will actually charge.
  useEffect(() => {
    for (const b of suggestions) {
      if (acceptedIds.has(b.id)) unacceptBundle(b.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  // Auto-pop a modal the first time each eligible offer surfaces (i.e. right
  // after the customer adds a trigger item). Once per offer id so it doesn't
  // nag; the cart screen's inline cards re-expose dismissed offers.
  useEffect(() => {
    if (!popupAllowed || popup || linkedConfig) return;
    const next = suggestions.find(
      (b) => !acceptedIds.has(b.id) && !shownPopupIds.current.has(b.id),
    );
    if (!next) return;
    shownPopupIds.current.add(next.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPopup(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, popup, linkedConfig, popupAllowed]);

  const acceptLegacy = useCallback(
    (b: BundleSuggestion) => {
      for (const a of b.addons ?? []) {
        for (let i = 0; i < a.qty; i++) {
          add({
            itemId: a.item_id,
            name: a.name,
            basePrice: a.base_price,
            artType: null,
            imageUrl: a.image_url,
            quantity: 1,
            sizeId: null,
            sizeName: null,
            sizeDelta: 0,
            options: [],
            notes: null,
            source: "upsell",
          });
        }
      }
      acceptBundle(b.id, b.savings);
    },
    [add, acceptBundle],
  );

  const acceptLinked = useCallback(
    (b: BundleSuggestion) => {
      if (!b.linked_item) return;
      const linkedId = b.linked_item.id;
      const baselineCount = lines.filter((l) => l.itemId === linkedId).length;
      setPendingSwap({
        bundleId: b.id,
        linkedItemId: linkedId,
        triggerItemIds: b.trigger_item_ids,
        baselineCount,
        savings: b.savings,
      });
      setLinkedLoading(true);
      fetch(`/api/v1/customer/menu-item?slug=${tenantSlug}&id=${encodeURIComponent(linkedId)}`)
        .then((r) => r.json())
        .then((d) => { if (d.item) setLinkedConfig(d); })
        .catch(() => {})
        .finally(() => setLinkedLoading(false));
    },
    [lines, tenantSlug],
  );

  const accept = useCallback(
    (b: BundleSuggestion) => {
      setPopup(null);
      // The combo carries its own modifiers - always open its ItemDetail so
      // the customer configures (drink, size, …) before it lands in the cart.
      if (b.mode === "linked") acceptLinked(b);
      else acceptLegacy(b);
    },
    [acceptLinked, acceptLegacy],
  );

  // Linked swap watcher: once the configured combo lands in the cart, drop
  // the trigger items it replaces and record the accepted bundle.
  useEffect(() => {
    if (!pendingSwap) return;
    const { linkedItemId, triggerItemIds, baselineCount, bundleId, savings } = pendingSwap;
    const currentCount = lines.filter((l) => l.itemId === linkedItemId).length;
    if (currentCount <= baselineCount) return;
    for (const l of lines) {
      if (triggerItemIds.includes(l.itemId)) remove(l.lineId);
    }
    acceptBundle(bundleId, savings);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingSwap(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, pendingSwap]);

  function closeLinked() {
    setLinkedConfig(null);
    if (pendingSwap) {
      const { linkedItemId, baselineCount } = pendingSwap;
      const currentCount = lines.filter((l) => l.itemId === linkedItemId).length;
      if (currentCount <= baselineCount) setPendingSwap(null);
    }
  }

  const offers = suggestions.filter((b) => !acceptedIds.has(b.id));

  return (
    <BundleContext.Provider value={{ offers, accept }}>
      {children}

      {popup && (
        <BundlePopup
          offer={popup}
          businessType={businessType}
          onDismiss={() => setPopup(null)}
          onAccept={() => accept(popup)}
        />
      )}

      {linkedConfig && (
        <ItemDetailModal onClose={closeLinked}>
          {linkedLoading || !linkedConfig ? (
            <ItemModalSkeleton />
          ) : (
            <ItemDetail
              tenantSlug={tenantSlug}
              businessType={(linkedConfig.tenant as { businessType: string }).businessType as never}
              item={linkedConfig.item as never}
              inModal
              addSource="upsell"
              onClose={closeLinked}
            />
          )}
        </ItemDetailModal>
      )}
    </BundleContext.Provider>
  );
}

export function bundleOfferImage(b: BundleSuggestion): string | null {
  return b.image_url ?? b.linked_item?.image_url ?? b.addons?.[0]?.image_url ?? null;
}

export function bundleOfferTitle(b: BundleSuggestion): string {
  if (b.mode === "linked" && b.linked_item) return b.linked_item.name;
  return b.name;
}

function BundlePopup({
  offer,
  businessType,
  onDismiss,
  onAccept,
}: {
  offer: BundleSuggestion;
  businessType: BusinessType;
  onDismiss: () => void;
  onAccept: () => void;
}) {
  const upgrade = offer.mode === "linked";
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/55 backdrop-blur-sm p-5">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-qf-modal-in">
        <div className="relative">
          <div className="w-full h-44 overflow-hidden">
            <MenuItemImage
              src={bundleOfferImage(offer)}
              alt={bundleOfferTitle(offer)}
              businessType={businessType}
              size={384}
              rounded="none"
              className="w-full h-full"
            />
          </div>
          {offer.savings > 0 && (
            <div className="absolute top-3 start-3 bg-qf-tomato text-white text-sm font-black px-3.5 py-1 rounded-full shadow-md tnum">
              חוסכים {formatPrice(offer.savings)}
            </div>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-3 end-3 w-8 h-8 rounded-full bg-white/90 grid place-items-center text-qf-ink shadow-sm"
            aria-label="סגור"
          >
            <IcoClose s={16} c="currentColor" />
          </button>
        </div>
        <div className="p-6 space-y-5 text-center">
          <div className="space-y-1.5">
            <div className="text-sm font-bold text-(--qf-primary)">
              {offer.savings > 0
                ? `${upgrade ? "תרצה לשדרג" : "מבצע"} ולחסוך ${formatPrice(offer.savings)}?`
                : upgrade
                  ? "תרצה לשדרג?"
                  : offer.name}
            </div>
            <h2 className="text-xl font-black text-qf-ink tracking-tight leading-tight break-words">
              {bundleOfferTitle(offer)}
            </h2>
            {offer.description && (
              <p className="text-sm text-qf-mute">{offer.description}</p>
            )}
          </div>
          <div className="flex items-baseline justify-center gap-2.5 tnum">
            <span className="text-3xl font-black text-(--qf-primary)">
              {formatPrice(offer.bundle_price)}
            </span>
            {offer.savings > 0 && (
              <span className="text-lg text-qf-mute line-through">{formatPrice(offer.full_price)}</span>
            )}
          </div>
          <div className="grid grid-cols-[1fr_1.5fr] gap-2.5">
            <button
              type="button"
              onClick={onDismiss}
              className="h-12 rounded-2xl border-2 border-qf-line-soft hover:bg-qf-line-soft text-qf-ink2 text-base font-bold transition"
            >
              לא תודה
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="h-12 rounded-2xl bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-base font-black shadow-sm active:scale-[0.98] transition"
            >
              {upgrade ? "שדרג" : "הוסף לסל"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
