/**
 * Per-STORE Meta Pixel helper, used only on the customer storefront.
 *
 * This is deliberately separate from the platform pixel in `lib/fb/pixel.ts`
 * (that one targets the QuickFood marketing site and never loads on `/s/`
 * storefronts). Here each tenant runs ITS OWN pixel, so every call is scoped
 * with `trackSingle` to the active pixel id and never touches any other pixel
 * that might be present. The id is registered by `<StorefrontPixel>` and read
 * by the cart / checkout / order screens when they fire events.
 */

let activePixelId: string | null = null;

/** Register (or clear) the storefront's pixel id. Idempotent. */
export function setStorefrontPixel(id: string | null) {
  activePixelId = id && /^\d{5,20}$/.test(id) ? id : null;
}

type Params = Record<string, unknown>;

/** Fire a standard Meta event against the active store pixel. No-op when no
 *  pixel is configured or fbq hasn't loaded yet - tracking must never throw. */
export function sfTrack(event: string, params: Params = {}) {
  if (!activePixelId) return;
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  try {
    window.fbq("trackSingle", activePixelId, event, params);
  } catch {
    /* fire and forget */
  }
}
