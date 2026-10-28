"use client";

import { useEffect } from "react";
import { sfTrack } from "@/lib/fb/storefront";

/**
 * Fires the store pixel `Purchase` event once per order on the post-order
 * screen. Deduped via localStorage keyed by order id so a refresh or a later
 * revisit of the tracking page never double-counts. No-op when the store has
 * no pixel (sfTrack guards on the active pixel id).
 */
export function StorePurchaseEvent({
  orderId,
  value,
  contentIds,
}: {
  orderId: string;
  value: number;
  contentIds: string[];
}) {
  useEffect(() => {
    const key = `qf:purch:${orderId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* private mode - still fire once this mount */
    }
    sfTrack("Purchase", {
      content_type: "product",
      content_ids: contentIds,
      num_items: contentIds.length,
      value,
      currency: "ILS",
    });
  }, [orderId, value, contentIds]);

  return null;
}
