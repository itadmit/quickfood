/**
 * Payment provider types (QuickFood, multi-tenant restaurant SaaS).
 *
 * Amounts in this module are in shekels (decimal) - callers convert from
 * Order.total (אגורות, Int) by dividing by 100 before passing in.
 */

import type { PaymentProvider } from "@prisma/client";

export type ProviderType = PaymentProvider; // "cash" | "grow" | "cardcom" | "hyp"

/**
 * Card-processing providers - everything except `cash`. Exactly one of these
 * may be active per tenant; widening the Prisma enum widens this with it.
 */
export type CardProviderType = Exclude<ProviderType, "cash">;

export type TransactionStatus =
  | "pending"
  | "processing"
  | "success"
  // J5 hold: the card was authorized and the amount reserved, but NOT captured.
  // The money only moves once the merchant captures it (see IPaymentProvider.capture).
  | "authorized"
  | "failed"
  | "cancelled";

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
  // Hyp (ex-YaadPay) per-merchant. All three mandatory - Hyp has no shared
  // sandbox terminal on our side. `apiKey` doubles as Hyp's KEY param (the
  // field above is Grow's; they live in separate PaymentProviderConfig rows
  // so there is no collision).
  masof?: string; // Hyp terminal number
  passP?: string; // Hyp API password (PassP)
  // Generic
  [key: string]: string | undefined;
}

/** How a redirect/hosted-page provider (CardCom, Hyp) surfaces its page. */
export type PaymentDisplayMode = "iframe" | "redirect";

export interface ProviderSettings {
  maxInstallments?: number;
  // CardCom: how to present the hosted LowProfile page, and whether to have
  // CardCom issue the tax document/invoice for the charge.
  displayMode?: PaymentDisplayMode;
  createInvoice?: boolean;
  documentType?: string; // CardCom DocumentTypeToCreate (e.g. "Order")
  // Hyp: let Hyp mail its own invoice (SendHesh). Off by default - QuickFood
  // sends its own order emails and we don't want duplicates.
  hypSendInvoice?: boolean;
  // "Late charge" (J5 / חיוב מאוחר): authorize + reserve the amount on the card
  // at order time, and only capture the money later when the merchant presses
  // "charge now" in the dashboard. Hyp-only for now. When off, charge
  // immediately (J4), the historical behaviour.
  deferredCapture?: boolean;
  // Sub-mode of `deferredCapture`: instead of auto-confirming the order and
  // waiting for a manual "charge now", hold the order in `pending` (awaiting
  // merchant approval, NOT in the kitchen) and capture the J5 hold the moment
  // the merchant accepts it ("אשר וקבל"). Only meaningful when
  // `deferredCapture` is also on. Hyp-only.
  captureOnApproval?: boolean;
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

// ─── Deferred capture (J5 "late charge") ───────────────────────
// Capture a previously-authorized hold so the money actually moves. Built from
// the stored authorization transaction; `rawData` is the original J5 callback
// (carries provider-specific fields the capture call needs, e.g. Hyp's UserId).
export interface CaptureRequest {
  providerTransactionId: string; // the authorization's transaction id
  approvalNumber?: string; // the authorization code (Hyp ACode)
  providerToken?: string; // provider token captured at auth (Hyp UID)
  amount: number; // shekels to capture (<= authorized amount)
  rawData?: Record<string, unknown>; // original authorization callback params
  // Cardholder name. Hyp's `soft` capture is rejected with CCode=401 ("first
  // or last name is required") unless the name the authorization was made with
  // is echoed back on the charge.
  customerFirstName?: string;
  customerLastName?: string;
}

export interface CaptureResponse {
  success: boolean;
  providerTransactionId?: string; // the NEW charge transaction id
  approvalNumber?: string;
  errorCode?: string;
  errorMessage?: string;
  rawData?: Record<string, unknown>;
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
  // Optional: only providers that support "late charge" (J5) implement this.
  // Captures a hold recorded by a prior `authorized` callback. Absent on
  // providers that don't support deferred capture.
  capture?(req: CaptureRequest): Promise<CaptureResponse>;
}
