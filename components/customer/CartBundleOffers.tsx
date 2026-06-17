"use client";

import { formatPrice } from "@/lib/format";
import { MenuItemImage, type BusinessType } from "@/components/shared/MenuItemImage";
import {
  useBundleOffers,
  bundleOfferImage,
  bundleOfferTitle,
  type BundleSuggestion,
} from "@/components/customer/CartBundleProvider";

/**
 * Cart-screen inline bundle cards. The fetch + accept flow + linked-combo
 * modal all live in CartBundleProvider (mounted in the customer layout);
 * this just renders the shared offer list so the customer can accept an
 * offer they dismissed in the popup.
 */
export function CartBundleOffers({ businessType }: { businessType: BusinessType }) {
  const { offers, accept } = useBundleOffers();
  if (offers.length === 0) return null;

  return (
    <div className="px-5 mt-5 lg:px-0">
      <div className="text-sm font-bold text-(--qf-deep) mb-2.5">מבצעים בשבילך</div>
      <div className="space-y-2.5">
        {offers.map((b) => (
          <OfferCard
            key={b.id}
            offer={b}
            businessType={businessType}
            onAccept={() => accept(b)}
          />
        ))}
      </div>
    </div>
  );
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
          src={bundleOfferImage(offer)}
          alt={bundleOfferTitle(offer)}
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
