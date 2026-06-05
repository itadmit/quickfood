/**
 * Client for Quick Commerce Billing Hub (the QuickFood billing partner).
 *
 * All QuickFood billing - subscription, transaction commissions, SMS package
 * purchases, refunds - is processed by this external service. We do NOT
 * implement billing locally; this file is the only thing in QuickFood that
 * speaks the hub's protocol.
 *
 * Spec: https://billing.my-quickshop.com (product: quickfood).
 *
 * Auth on outbound:
 *   Authorization: Bearer <QC_BILLING_API_KEY>
 *   X-Product-Id: quickfood
 *   X-Timestamp: <unix seconds>
 *   X-Signature: HMAC-SHA256(QC_BILLING_HMAC_SECRET, "<ts>.<rawBody>") hex
 *   X-Idempotency-Key: <uuid>  (mutations only)
 *
 * Inbound webhooks are signed differently:
 *   X-Quickcommerce-Signature: sha256=<HMAC-SHA256(QC_BILLING_HMAC_SECRET, rawBody)>
 */
import crypto from "node:crypto";

const BASE = process.env.QC_BILLING_BASE_URL?.replace(/\/$/, "") ?? "";
const API_KEY = process.env.QC_BILLING_API_KEY ?? "";
const PRODUCT_ID = process.env.QC_BILLING_PRODUCT_ID ?? "quickfood";
const HMAC_SECRET = process.env.QC_BILLING_HMAC_SECRET ?? "";

export class BillingHubError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "BillingHubError";
  }
}

function sign(timestamp: string, rawBody: string): string {
  return crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

export interface RequestOpts {
  /** Force a specific idempotency key. Defaults to a fresh UUID. */
  idempotencyKey?: string;
}

async function request<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  opts: RequestOpts = {},
): Promise<T> {
  if (!BASE || !API_KEY || !HMAC_SECRET) {
    throw new BillingHubError(
      "QC_BILLING_BASE_URL / API_KEY / HMAC_SECRET missing - billing-hub client not configured",
      503,
      "not_configured",
    );
  }

  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign(timestamp, rawBody);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
    "X-Product-Id": PRODUCT_ID,
    "X-Timestamp": timestamp,
    "X-Signature": signature,
  };
  if (method !== "GET") {
    headers["X-Idempotency-Key"] = opts.idempotencyKey ?? crypto.randomUUID();
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: rawBody || undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const parsed = text ? safeJson(text) : null;

  if (!res.ok) {
    const code = (parsed as { error?: { code?: string } } | null)?.error?.code;
    const msg =
      (parsed as { error?: { message?: string } } | null)?.error?.message ??
      `billing-hub ${method} ${path} failed: ${res.status}`;
    throw new BillingHubError(msg, res.status, code, parsed);
  }

  return parsed as T;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// ─── Typed helpers ─────────────────────────────────────────────────

export interface BillingCustomer {
  id: string;
  email: string;
  phone?: string;
  name: string;
}

/**
 * Upsert a billing customer (by email). Pass `external_id` so we can look the
 * tenant up later from webhooks that include only the customer id.
 */
export function createCustomer(input: {
  email: string;
  name: string;
  phone?: string;
  vat_number?: string;
  external_id?: string;
  external_slug?: string;
  metadata?: Record<string, string>;
}) {
  return request<BillingCustomer>("POST", "/api/v1/customers", input);
}

export interface PaymentMethodSetup {
  session_id: string;
  payment_page_url: string;
  page_request_uid?: string;
  expires_at?: string;
}

/**
 * Generate a Grow tokenization URL the customer visits to save a card.
 *
 *  - `subscription_setup` charges the first-month total (e.g. ₪352.82
 *     incl. VAT) - used the first time a merchant sets up billing.
 *  - `card_update` only verifies the card with ₪1 hold (chargeType=3),
 *     no recurring charge. Used to replace a saved card without
 *     re-paying.
 *  - `topup` is reserved.
 *
 * `accept` is required by the hub (Grow regulatory): the merchant must
 * have ticked an "I authorize storing my card for future charges"
 * checkbox in our UI before we call this endpoint. The hub persists a
 * timestamp as the audit trail.
 */
export function createPaymentMethodSetup(input: {
  customer_id: string;
  accept: true;
  context_type: "subscription_setup" | "card_update" | "topup";
  amount: number;
  success_url: string;
  failure_url: string;
}) {
  return request<PaymentMethodSetup>("POST", "/api/v1/payment-methods/setup", input);
}

export interface BillingSubscription {
  id: string;
  status: string;
  billing_interval: string;
  current_period_end: string;
  trial_ends_at?: string;
}

/**
 * Create a recurring subscription. `plan_code` matches the product's plan
 * codes on the hub (`quickfood_base`, `quickfood_sms_*`). With `trial_days`
 * set the subscription starts in trial; otherwise it activates immediately
 * (and a payment method is required).
 */
export function createSubscription(input: {
  customer_id: string;
  plan_code: string;
  billing_interval?: "monthly" | "yearly";
  trial_days?: number;
  payment_method_id?: string;
  metadata?: Record<string, string>;
}) {
  return request<BillingSubscription>("POST", "/api/v1/subscriptions", input);
}

/**
 * Cancel a subscription. Default behaviour is end-of-period; pass
 * `at_period_end: false` for an immediate cancel (used when switching SMS plans
 * mid-month so the merchant isn't double-billed).
 */
export function cancelSubscription(
  subscriptionId: string,
  input: { reason?: string; at_period_end?: boolean } = {},
) {
  return request<BillingSubscription>(
    "POST",
    `/api/v1/subscriptions/${subscriptionId}/cancel`,
    input,
  );
}

export interface SubscriptionDetail {
  id: string;
  customer_id: string;
  product_id: string;
  plan_id: string;
  pending_plan_id?: string | null;
  status: string;
  billing_interval: string;
  current_period_start?: string;
  current_period_end: string;
  trial_ends_at?: string | null;
  payment_method_id?: string | null;
  cancel_at_period_end: boolean;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
}

/** Fetch the full subscription record from the hub. */
export function getSubscription(subscriptionId: string) {
  return request<SubscriptionDetail>(
    "GET",
    `/api/v1/subscriptions/${subscriptionId}`,
  );
}

/**
 * PATCH a subscription. Mostly used here to undo a scheduled cancel by
 * sending `cancel_at_period_end: false` after the merchant clicks
 * "ביטול ביטול".
 */
export function patchSubscription(
  subscriptionId: string,
  input: {
    cancel_at_period_end?: boolean;
    plan_code?: string;
    payment_method_id?: string;
  },
) {
  return request<SubscriptionDetail>(
    "PATCH",
    `/api/v1/subscriptions/${subscriptionId}`,
    input,
  );
}

/**
 * Push a per-order commission for end-of-month billing. `idempotency_key`
 * scoped to the order id prevents double-recording on retries.
 */
export function recordCommission(input: {
  customer_id: string;
  subscription_id?: string;
  source_external_id: string;
  idempotency_key: string;
  amount: number;
  fee_rate: number;
  period_start?: string;
  period_end?: string;
}) {
  return request<{ id: string; base_amount: string; status: string }>(
    "POST",
    "/api/v1/commissions",
    input,
  );
}

/**
 * One-off charge against the customer's saved payment method. Used for SMS
 * top-up purchases (Starter/Growth/Scale).
 *
 * `amount` is the **base** amount in shekels (pre-VAT). The hub adds 18% VAT
 * internally and returns the breakdown. Same convention as every other
 * endpoint on this hub. `idempotency_key` is required by the hub to prevent
 * double-charging on retries; we forward it both in the body and as the
 * `X-Idempotency-Key` header.
 */
export interface ChargeResponse {
  ok: boolean;
  invoice_id?: string;
  invoice_number?: string;
  invoice_url?: string | null;
  transaction_uid?: string;
  // New (2026-05-21): hub returns the VAT split explicitly.
  base_amount?: number;
  vat_amount?: number;
  total_amount?: number;
  currency?: string;
  // Failure shape (HTTP 402)
  reason?: string;
  error?: string;
  error_code?: string;
}

export function createCharge(input: {
  customer_id: string;
  amount: number;
  description: string;
  idempotency_key: string;
  payment_method_id?: string;
  metadata?: Record<string, string | number>;
}) {
  return request<ChargeResponse>("POST", "/api/v1/charges", input, {
    idempotencyKey: input.idempotency_key,
  });
}

export interface BillingInvoice {
  id: string;
  status: string;
  type: string;
  total: number;
  issued_at: string;
}

export function listInvoices(customerId: string) {
  return request<{ invoices: BillingInvoice[] }>(
    "GET",
    `/api/v1/invoices?customer_id=${encodeURIComponent(customerId)}`,
  );
}

// ─── Inbound webhook signature verification ─────────────────────────

/**
 * Verify an inbound webhook from the billing hub. The hub signs the raw body
 * with `QC_BILLING_HMAC_SECRET` and sends the digest in
 * `X-Quickcommerce-Signature: sha256=<hex>`. No timestamp header.
 */
export function verifyWebhook(rawBody: string, headers: Headers): boolean {
  if (!HMAC_SECRET) return false;
  const sigHeader = headers.get("x-quickcommerce-signature");
  if (!sigHeader || !sigHeader.startsWith("sha256=")) return false;
  const sigHex = sigHeader.slice("sha256=".length);

  const expectedHex = crypto
    .createHmac("sha256", HMAC_SECRET)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHex), Buffer.from(sigHex));
  } catch {
    return false;
  }
}
