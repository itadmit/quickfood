/**
 * Shared Grow sandbox credentials.
 *
 * When a tenant flips PaymentProviderConfig.testMode = true on
 * /dashboard/settings/payments, the GrowProvider swaps the merchant's own
 * userId / apiKey / pageCode for these constants - so anyone can flip into
 * "Sandbox" without having to set up their own test account at Grow.
 *
 * Real money never flows through these credentials: they belong to Grow's
 * sandbox environment (sandbox.meshulam.co.il), which only accepts the
 * provider's test card numbers.
 *
 * Sourced from Grow's "חשבון הטסטים" handoff. Safe to live in source code
 * - Grow themselves publish them as the public sandbox account.
 */

export const GROW_SHARED_TEST_USER_ID = "814d52344861c4a3";
export const GROW_SHARED_TEST_API_KEY = "7018a83ce5b9";
export const GROW_SHARED_TEST_PAGE_CODE = "239ed72cde47";
