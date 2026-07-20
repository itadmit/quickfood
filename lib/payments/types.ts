/**
 * Payment provider types (QuickFood, multi-tenant restaurant SaaS).
 *
 * Amounts in this module are in shekels (decimal) - callers convert from
 * Order.total (אגורות, Int) by dividing by 100 before passing in.
 */

import type { PaymentProvider } from "@prisma/client";

export type ProviderType = PaymentProvider; // "cash" | "grow"

export type TransactionStatus = "pending" | "processing" | "success" | "failed" | "cancelled";

// ─── Configuration ─────────────────────────────────────────────

export interface ProviderCredentials {
  // Grow per-merchant. PRODUCTION requires apiKey per tenant - sandbox
  // shares one platform key but live merchants each have their own.
  userId?: string;
  pageCode?: string; // optional override of platform default
  apiKey?: string; // per-tenant for PROD; falls back to env GROW_API_KEY
  // CardCom per-merchant (all three mandatory for live charging). Stored as
  // strings in JSONB; terminalNumber is Number()-coerced at call time.
  terminalNumber?: string;
  apiName?: string;
  apiPassword?: string;
  // Generic
  [key: string]: string | undefined;
}

/** How a redirect/hosted-page provider (CardCom) surfaces its payment page. */
export type PaymentDisplayMode = "iframe" | "redirect";

export interface ProviderSettings {
  maxInstallments?: number;
  // CardCom: how to present the hosted LowProfile page, and whether to have
  // CardCom issue the tax document/invoice for the charge.
  displayMode?: PaymentDisplayMode;
  createInvoice?: boolean;
  documentType?: string; // CardCom DocumentTypeToCreate (e.g. "Order")
  [key: string]: unknown;
}

export interface ProviderConfig {
  provider: ProviderType;
  credentials: ProviderCredentials;
  settings: ProviderSettings;
  testMode: boolean;
  isActive: boolean;
}

// ─── Requests / responses ──────────────────────────────────────

export interface PaymentCustomer {
  name: string;
  email?: string;
  phone?: string;
}

export interface PaymentItem {
  name: string;
  sku?: string;
  quantity: number;
  price: number; // shekels, per unit
}

export interface InitiatePaymentRequest {
  tenantId: string;
  tenantSlug: string;
  orderId: string;
  orderReference: string; // round-trips back through callback (cField1)
  amount: number; // shekels (decimal)
  currency?: string; // default ILS
  customer: PaymentCustomer;
  items: PaymentItem[];
  successUrl: string;
  cancelUrl: string;
  failureUrl?: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  /// SDK Wallet mode (Grow): client calls window.growPayment.renderPaymentOptions(authCode).
  sdkAuthCode?: string;
  /// Hosted-page redirect mode (CardCom LowProfile / Grow redirect fallback).
  paymentUrl?: string;
  /// For hosted-page providers: how the client should present `paymentUrl`.
  displayMode?: PaymentDisplayMode;
  providerRequestId?: string; // Grow processId / CardCom LowProfileId
  errorCode?: string;
  errorMessage?: string;
  providerResponse?: Record<string, unknown>;
}

export interface ParsedCallback {
  success: boolean;
  status: TransactionStatus;
  providerTransactionId: string;
  providerRequestId?: string;
  approvalNumber?: string; // asmachta
  amount: number; // shekels
  currency: string;
  orderReference?: string; // our reference (from cField1)
  cardBrand?: string;
  cardLastFour?: string;
  providerToken?: string; // transactionToken (needed for refunds)
  // Some providers (CardCom) issue the tax document synchronously and return
  // it on the same result we finalize the order with. Grow ships it later via
  // a separate invoice-callback, so it leaves these unset.
  invoiceNumber?: string;
  invoiceUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  rawData: Record<string, unknown>;
}

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
}

export interface RefundRequest {
  providerTransactionId: string;
  providerToken?: string; // transactionToken from original transaction
  amount: number; // shekels
}

export interface RefundResponse {
  success: boolean;
  providerRefundId?: string;
  refundedAmount?: number;
  errorCode?: string;
  errorMessage?: string;
}

// ─── Provider interface ────────────────────────────────────────

export interface IPaymentProvider {
  readonly providerType: ProviderType;
  readonly displayName: string;

  configure(config: ProviderConfig): void;
  initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse>;
  validateWebhook(body: unknown, headers: Record<string, string>): WebhookValidationResult;
  // May be async: CardCom re-fetches the authoritative result via GetLpResult
  // (its callback carries no signature/IP guard, so the posted body is not
  // trusted). Grow parses synchronously and returns a plain object; callers
  // must `await` this regardless.
  parseCallback(body: unknown): ParsedCallback | Promise<ParsedCallback>;
  acknowledgeCallback(parsed: ParsedCallback): Promise<{ success: boolean; error?: string }>;
  refund(req: RefundRequest): Promise<RefundResponse>;
}
