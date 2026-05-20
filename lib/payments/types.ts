/**
 * Payment provider types (QuickFood, multi-tenant restaurant SaaS).
 *
 * Amounts in this module are in shekels (decimal) — callers convert from
 * Order.total (אגורות, Int) by dividing by 100 before passing in.
 */

import type { PaymentProvider } from "@prisma/client";

export type ProviderType = PaymentProvider; // "cash" | "grow"

export type TransactionStatus = "pending" | "processing" | "success" | "failed" | "cancelled";

// ─── Configuration ─────────────────────────────────────────────

export interface ProviderCredentials {
  // Grow per-merchant
  userId?: string;
  pageCode?: string; // optional override of platform default
  // Generic
  [key: string]: string | undefined;
}

export interface ProviderSettings {
  maxInstallments?: number;
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
  /// Hosted-page redirect mode (fallback).
  paymentUrl?: string;
  providerRequestId?: string; // Grow processId
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
  parseCallback(body: unknown): ParsedCallback;
  acknowledgeCallback(parsed: ParsedCallback): Promise<{ success: boolean; error?: string }>;
  refund(req: RefundRequest): Promise<RefundResponse>;
}
