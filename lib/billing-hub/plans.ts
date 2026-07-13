/**
 * Managed-WhatsApp reviews add-on - ₪99/mo + VAT, unlimited review-request
 * sends through the platform iBot account. No SMS-credit deduction. Mirrored
 * to Tenant.reviewsWhatsappSubscriptionId via the billing-hub webhook.
 */
export const REVIEWS_WHATSAPP_PLAN_CODE = "quickfood_reviews_whatsapp";

/** Base price (pre-VAT) of the managed reviews-WhatsApp add-on, in shekels. */
export const REVIEWS_WHATSAPP_BASE_PRICE = 99;

/** Base platform plan - ₪299/mo + VAT, mirrored on the hub as quickfood_base. */
export const BASE_PLAN_CODE = "quickfood_base";
export const BASE_PLAN_PRICE = 299;

/**
 * Negotiated intro price (pre-VAT shekels) for the tenant's base plan, or
 * null when none is active. Active = both fields set and the end date is
 * still in the future; the expire-intro-prices job clears the fields (and
 * the hub-side override) once the date passes.
 */
export function activeIntroPrice(tenant: {
  introMonthlyPrice: number | null;
  introPriceUntil: Date | null;
}): number | null {
  if (tenant.introMonthlyPrice == null || !tenant.introPriceUntil) return null;
  if (tenant.introPriceUntil.getTime() <= Date.now()) return null;
  return tenant.introMonthlyPrice;
}
