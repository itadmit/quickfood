"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/format";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import { ItemDetailModal } from "@/components/customer/ItemDetailModal";
import { ItemDetail } from "@/components/customer/screens/ItemDetail";
import ItemModalSkeleton from "@/components/customer/ItemModalSkeleton";
import { IcoClose } from "@/components/shared/Icons";
import { useCart } from "@/components/customer/CartProvider";

interface BundleSuggestion {
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

/**
 * Surfaces the active bundle offers on the cart screen. Mirrors the kiosk
 * flow (KioskApp): fetch /cart-bundles on every cart change, auto-pop a
 * modal for a fresh offer, and list the offers inline so the customer can
 * accept them. Legacy bundles inject their addons directly; Wolt-style
 * "linked" bundles open the combo's ItemDetail so the customer configures
 * it, then swap the trigger items out so nothing is double-billed.
 *
 * Accepted bundle ids live in the CartProvider so checkout can submit them
 * as `applied_bundle_ids`; the server re-verifies and applies the discount.
 */
export function CartBundleOffers({
  tenantSlug,
  businessType,
}: {
  tenantSlug: string;
  businessType: BusinessType;
}) {
  const { lines, add, remove, acceptedBundles, acceptBundle, unacceptBundle } = useCart();

  const [suggestions, setSuggestions] = useState<BundleSuggestion[]>([]);
  const [popup, setPopup] = useState<BundleSuggestion | null>(null);
  const shownPopupIds = useRef<Set<string>>(new Set());

  // Linked-mode flow: the combo item to open for configuration + the
  // pending trigger swap to run once it lands in the cart.
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

  // Reconcile: if an accepted bundle re-appears as a suggestion, the cart
  // no longer satisfies it (an addon was removed), so the discount would
  // be dropped server-side - un-accept it to keep the displayed total honest.
  useEffect(() => {
    for (const b of suggestions) {
      if (acceptedIds.has(b.id)) unacceptBundle(b.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  // Auto-pop a modal once per offer (per session) so a fresh trigger add
  // re-prompts. Skips offers already accepted.
  useEffect(() => {
    if (popup || linkedConfig) return;
    const next = suggestions.find(
      (b) => !acceptedIds.has(b.id) && !shownPopupIds.current.has(b.id),
    );
    if (!next) return;
    shownPopupIds.current.add(next.id);
    setPopup(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, popup, linkedConfig]);

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

  function accept(b: BundleSuggestion) {
    setPopup(null);
    if (b.mode === "linked") acceptLinked(b);
    else acceptLegacy(b);
  }

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

  // Combo modal closed without an add - drop the pending swap so the offer
  // can prompt again later.
  function closeLinked() {
    setLinkedConfig(null);
    if (pendingSwap) {
      const { linkedItemId, baselineCount } = pendingSwap;
      const currentCount = lines.filter((l) => l.itemId === linkedItemId).length;
      if (currentCount <= baselineCount) setPendingSwap(null);
    }
  }

  const visible = suggestions.filter((b) => !acceptedIds.has(b.id));

  return (
    <>
      {visible.length > 0 && (
        <div className="px-5 mt-5 lg:px-0">
          <div className="text-sm font-bold text-(--qf-deep) mb-2.5">מבצעים בשבילך</div>
          <div className="space-y-2.5">
            {visible.map((b) => (
              <OfferCard
                key={b.id}
                offer={b}
                businessType={businessType}
                onAccept={() => accept(b)}
              />
            ))}
          </div>
        </div>
      )}

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
    </>
  );
}

function offerImage(b: BundleSuggestion): string | null {
  return (
    b.image_url ??
    b.linked_item?.image_url ??
    b.addons?.[0]?.image_url ??
    null
  );
}

function offerTitle(b: BundleSuggestion): string {
  if (b.mode === "linked" && b.linked_item) return b.linked_item.name;
  return b.name;
}

function OfferCard({
  offer,
  businessType,
  onAccept,
}: {
  offer: BundleSuggestion;
  businessType: BusinessType;
  onAccept: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-(--qf-primary)/30 p-3.5 flex gap-3.5 shadow-xs">
      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
        <MenuItemImage
          src={offerImage(offer)}
          alt={offerTitle(offer)}
          businessType={businessType}
          size={64}
          rounded="xl"
          className="w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold leading-tight">{offer.name}</div>
        {offer.description ? (
          <div className="text-xs text-qf-mute mt-0.5 line-clamp-2">{offer.description}</div>
        ) : (
          offer.mode === "linked" &&
          offer.linked_item && (
            <div className="text-xs text-qf-mute mt-0.5">שדרוג ל{offer.linked_item.name}</div>
          )
        )}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-2 tnum">
            <span className="font-bold text-(--qf-deep)">{formatPrice(offer.bundle_price)}</span>
            {offer.savings > 0 && (
              <span className="text-xs text-qf-mute line-through">{formatPrice(offer.full_price)}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onAccept}
            className="px-4 h-9 rounded-full bg-(--qf-primary) hover:bg-(--qf-deep) text-white text-sm font-semibold transition"
          >
            {offer.savings > 0 ? `הוסף · חוסכים ${formatPrice(offer.savings)}` : "הוסף"}
          </button>
        </div>
      </div>
    </div>
  );
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
              src={offerImage(offer)}
              alt={offerTitle(offer)}
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
              {offerTitle(offer)}
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
