import type { Tenant } from "@prisma/client";

export type StorefrontBlock = "suspended" | "trial_ended" | null;

type BillingFields = Pick<
  Tenant,
  "billingSuspendedAt" | "status" | "trialEndsAt" | "billingSetupCompletedAt"
>;

/**
 * Why (if at all) a store's storefront + checkout is blocked.
 * - "suspended": hub cancelled the base subscription for non-payment, or an
 *   admin set status=suspended.
 * - "trial_ended": the 7-day trial lapsed and the merchant never saved a
 *   payment method. This is the case that let expired stores keep taking
 *   (fake) orders — status stays "active" through the trial, so it wasn't caught.
 * A paying store (billingSetupCompletedAt set) or one still in trial is never blocked.
 */
export function storefrontBlock(t: BillingFields): StorefrontBlock {
  if (t.billingSuspendedAt || t.status === "suspended") return "suspended";
  if (t.trialEndsAt && t.trialEndsAt.getTime() < Date.now() && !t.billingSetupCompletedAt) {
    return "trial_ended";
  }
  return null;
}

export function isStorefrontBlocked(t: BillingFields): boolean {
  return storefrontBlock(t) !== null;
}
