/**
 * CardCom provider (Israeli payment gateway), v11 JSON API.
 *
 * Docs: https://secure.cardcom.solutions/swagger/index.html?url=/swagger/v11/swagger.json
 *
 * Auth model (all per-tenant, no platform-level env):
 *   TerminalNumber - merchant's terminal (e.g. 1000 for the shared test terminal)
 *   ApiName        - API user name
 *   ApiPassword    - API password (mandatory for refunds; sent on every call)
 *
 * Flow (differs from Grow's inline SDK wallet):
 *   1. initiatePayment -> POST /LowProfile/Create -> returns a hosted-page Url.
 *      The client redirects to it, or embeds it in an iframe (merchant choice).
 *   2. Customer pays on CardCom's page; CardCom POSTs a webhook to our
 *      /api/payments/callback and redirects the browser to SuccessRedirectUrl.
 *   3. parseCallback re-fetches the AUTHORITATIVE result via /LowProfile/GetLpResult
 *      (the webhook body is untrusted - CardCom sends no signature/IP guard, so
 *      we never mark an order paid off the posted body alone). A forged
 *      LowProfileId won't verify; real ones are unguessable GUIDs.
 *   4. No ack step (unlike Grow's /approveTransaction) - returning 200 is enough.
 *
 * Amounts are whole/decimal shekels end-to-end (same convention as Grow's `sum`
 * and Order.total - QuickFood does NOT use agorot in these fields).
 */

import { BasePaymentProvider } from "../base";
import type {
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  ParsedCallback,
  PaymentDisplayMode,
  ProviderConfig,
  ProviderType,
  RefundRequest,
  RefundResponse,
  TransactionStatus,
  WebhookValidationResult,
} from "../types";

// ─── CardCom shared test credentials (terminal 1000) ──────────────
// Used only when the merchant flips "test mode" on but hasn't pasted their
// own terminal yet - lets the sandbox flow "just work" like Grow's does.
const CARDCOM_TEST_TERMINAL = "1000";
const CARDCOM_TEST_API_NAME = "kzFKfohEvL6AOF8aMEJz";
const CARDCOM_TEST_API_PASSWORD = "FIDHIh4pAadw3Slbdsjg";

const ISO_ILS = 1;

// ─── CardCom response shapes (subset we consume) ──────────────────

interface CreateLowProfileResponse {
  ResponseCode?: number;
  Description?: string;
  LowProfileId?: string;
  Url?: string;
}

interface CardComTranzactionInfo {
  ResponseCode?: number;
  TranzactionId?: number;
  Amount?: number;
  Last4?: number | string;
  CardOwnerName?: string;
  ApprovalNumber?: string;
  Token?: string;
  NumberOfPayments?: number;
  Brand?: number | string;
  CardName?: string;
}

interface CardComTokenInfo {
  Token?: string;
}

interface CardComDocumentInfo {
  DocumentNumber?: number | string;
  DocumentType?: string;
  DocumentUrl?: string;
}

interface LowProfileResult {
  ResponseCode?: number;
  Description?: string;
  TerminalNumber?: number;
  LowProfileId?: string;
  ReturnValue?: string;
  Operation?: string;
  TranzactionId?: number;
  TranzactionInfo?: CardComTranzactionInfo;
  TokenInfo?: CardComTokenInfo;
  DocumentInfo?: CardComDocumentInfo;
}

interface RefundResp {
  ResponseCode?: number;
  Description?: string;
  TranzactionId?: number;
  NewTransactionId?: number;
  NewTranzactionId?: number;
}

// CardCom card-brand codes -> our lowercase brand slugs (best-effort).
const CARD_BRAND_MAP: Record<string, string> = {
  "1": "isracard",
  "2": "visa",
  "3": "mastercard",
  "4": "amex",
  "5": "diners",
  "6": "jcb",
};

export class CardComProvider extends BasePaymentProvider {
  readonly providerType: ProviderType = "cardcom";
  readonly displayName = "CardCom";

  // Single host for both test and live - the terminal number is what
  // distinguishes them (test terminal 1000 vs the merchant's live terminal).
  private static readonly API_BASE = "https://secure.cardcom.solutions/api/v11";

  protected validateConfig(config: ProviderConfig): void {
    // Test mode short-circuits: fall back to the shared test terminal so the
    // sandbox works with nothing filled in (mirrors GrowProvider).
    if (config.testMode) return;
    const c = config.credentials;
    if (!c.terminalNumber) throw new Error("CardCom: credentials.terminalNumber is required");
    if (!c.apiName) throw new Error("CardCom: credentials.apiName is required");
    if (!c.apiPassword) throw new Error("CardCom: credentials.apiPassword is required");
  }

  // ─── Credential accessors (test-mode falls back to the shared terminal) ──

  // In test mode we ALWAYS use the shared test terminal, ignoring whatever the
  // merchant has stored - flipping "Sandbox" on is meant to JUST WORK (mirrors
  // GrowProvider). This also shields us from browser password-manager autofill
  // dumping the merchant's dashboard login into the API credential fields.
  private get terminalNumber(): number {
    if (this.config!.testMode) return Number(CARDCOM_TEST_TERMINAL);
    return Number(this.config!.credentials.terminalNumber);
  }

  private get apiName(): string {
    if (this.config!.testMode) return CARDCOM_TEST_API_NAME;
    return this.config!.credentials.apiName!;
  }

  private get apiPassword(): string {
    if (this.config!.testMode) return CARDCOM_TEST_API_PASSWORD;
    return this.config!.credentials.apiPassword!;
  }

  private get displayMode(): PaymentDisplayMode {
    return this.config!.settings?.displayMode === "iframe" ? "iframe" : "redirect";
  }

  private get auth() {
    return {
      TerminalNumber: this.terminalNumber,
      ApiName: this.apiName,
      ApiPassword: this.apiPassword,
    };
  }

  private async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    this.ensureConfigured();
    const url = `${CardComProvider.API_BASE}${endpoint}`;
    this.log(`POST ${endpoint}`, { bodyKeys: Object.keys(body) });
    const res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      this.logError(`Non-JSON response from ${endpoint}`, {
        status: res.status,
        body: text.slice(0, 500),
      });
      throw new Error(`CardCom API non-JSON response (HTTP ${res.status})`);
    }
  }

  // ─── Public API ─────────────────────────────────────────────

  async initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    this.ensureConfigured();
    try {
      const amount = this.formatAmount(req.amount);
      const maxInstallments = Number(this.config!.settings?.maxInstallments) || 1;
      const createInvoice = this.config!.settings?.createInvoice === true;

      const body: Record<string, unknown> = {
        ...this.auth,
        ReturnValue: req.orderReference, // round-trips back as LowProfileResult.ReturnValue
        Amount: amount,
        ISOCoinId: ISO_ILS,
        Language: "he",
        Operation: "ChargeOnly",
        ProductName: `Order ${req.orderReference}`,
        SuccessRedirectUrl: req.successUrl,
        FailedRedirectUrl: req.failureUrl || req.cancelUrl,
        WebHookUrl: this.buildCallbackUrl(req.tenantSlug),
      };

      // Installments: let the customer pick up to `maxInstallments`. The
      // number-of-payments UI on CardCom's page is gated by the terminal
      // config too, so this is a ceiling, not a guarantee.
      if (maxInstallments >= 2) {
        body.AdvancedDefinition = {
          MinNumOfPayments: 1,
          MaxNumOfPayments: Math.min(maxInstallments, 12),
        };
      }

      // Have CardCom issue the tax document (חשבונית/קבלה) for this charge when
      // the merchant chose CardCom for invoicing. The document surfaces on the
      // GetLpResult we finalize with.
      if (createInvoice) {
        const documentType = String(this.config!.settings?.documentType || "Order");
        body.Document = {
          Name: req.customer.name,
          To: req.customer.name,
          Email: req.customer.email || "",
          DocumentTypeToCreate: documentType,
          Products: req.items.map((it) => ({
            Description: it.name,
            Quantity: it.quantity,
            UnitCost: it.price,
          })),
        };
      }

      const response = await this.post<CreateLowProfileResponse>("/LowProfile/Create", body);

      if (response.ResponseCode === 0 && response.Url) {
        return {
          success: true,
          paymentUrl: response.Url,
          displayMode: this.displayMode,
          providerRequestId: response.LowProfileId,
          providerResponse: response as unknown as Record<string, unknown>,
        };
      }

      this.logError("LowProfile/Create failed", {
        responseCode: response.ResponseCode,
        description: response.Description,
        terminal: this.terminalNumber,
        amount,
      });
      return {
        success: false,
        errorCode: String(response.ResponseCode ?? "cardcom_initiate_failed"),
        errorMessage: response.Description || "Failed to create CardCom payment page",
        providerResponse: response as unknown as Record<string, unknown>,
      };
    } catch (error) {
      this.logError("initiatePayment failed", error);
      return {
        success: false,
        errorCode: "cardcom_error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // No IP whitelist / HMAC from CardCom - the real guard is the GetLpResult
  // re-fetch inside parseCallback, so nothing to validate here.
  validateWebhook(_body: unknown, _headers: Record<string, string>): WebhookValidationResult {
    this.ensureConfigured();
    return { isValid: true };
  }

  /**
   * Authoritative parse: read the LowProfileId off the (untrusted) webhook body
   * or query string, then re-fetch the real result from CardCom. We build the
   * ParsedCallback entirely from that server-verified result.
   */
  async parseCallback(body: unknown): Promise<ParsedCallback> {
    this.ensureConfigured();
    const lowProfileId = this.extractLowProfileId(body);
    const empty: ParsedCallback = {
      success: false,
      status: "failed",
      providerTransactionId: "",
      amount: 0,
      currency: "ILS",
      rawData: (typeof body === "object" && body ? body : {}) as Record<string, unknown>,
    };
    if (!lowProfileId) {
      this.logError("callback missing LowProfileId", { body });
      return empty;
    }

    let result: LowProfileResult;
    try {
      result = await this.post<LowProfileResult>("/LowProfile/GetLpResult", {
        ...this.auth,
        LowProfileId: lowProfileId,
      });
    } catch (error) {
      this.logError("GetLpResult failed", error);
      return { ...empty, providerRequestId: lowProfileId };
    }

    const txn = result.TranzactionInfo ?? {};
    const lpOk = result.ResponseCode === 0;
    const txnOk = txn.ResponseCode === undefined || txn.ResponseCode === 0;
    const isSuccess = lpOk && txnOk && !!txn.TranzactionId;
    const status: TransactionStatus = isSuccess ? "success" : "failed";

    const brand =
      txn.Brand !== undefined
        ? CARD_BRAND_MAP[String(txn.Brand)] || String(txn.Brand)
        : txn.CardName || undefined;

    const doc = result.DocumentInfo;

    this.log("Parsed callback", {
      lowProfileId,
      responseCode: result.ResponseCode,
      txnId: txn.TranzactionId,
      returnValue: result.ReturnValue,
    });

    return {
      success: isSuccess,
      status,
      providerTransactionId: txn.TranzactionId ? String(txn.TranzactionId) : "",
      providerRequestId: lowProfileId,
      approvalNumber: txn.ApprovalNumber,
      amount: Number(txn.Amount) || 0,
      currency: "ILS",
      orderReference: result.ReturnValue,
      cardBrand: brand,
      cardLastFour: txn.Last4 !== undefined ? String(txn.Last4) : undefined,
      providerToken: txn.Token || result.TokenInfo?.Token,
      invoiceNumber: doc?.DocumentNumber !== undefined ? String(doc.DocumentNumber) : undefined,
      invoiceUrl: doc?.DocumentUrl || undefined,
      errorCode: isSuccess ? undefined : String(result.ResponseCode ?? txn.ResponseCode ?? ""),
      errorMessage: isSuccess ? undefined : result.Description,
      rawData: result as unknown as Record<string, unknown>,
    };
  }

  // CardCom needs no acknowledgement call back - a 200 on the webhook is the
  // whole contract.
  async acknowledgeCallback(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    this.ensureConfigured();
    const txnId = Number(req.providerTransactionId);
    if (!txnId) {
      return { success: false, errorCode: "cardcom_bad_txn", errorMessage: "Missing CardCom transaction id" };
    }
    if (!this.apiPassword) {
      return {
        success: false,
        errorCode: "cardcom_no_password",
        errorMessage: "CardCom refunds require an API password",
      };
    }
    try {
      const response = await this.post<RefundResp>("/Transactions/RefundByTransactionId", {
        ...this.auth,
        TransactionId: txnId,
        PartialSum: this.formatAmount(req.amount),
      });
      if (response.ResponseCode === 0) {
        const newId = response.NewTransactionId ?? response.NewTranzactionId ?? response.TranzactionId ?? txnId;
        return {
          success: true,
          providerRefundId: String(newId),
          refundedAmount: req.amount,
        };
      }
      return {
        success: false,
        errorCode: String(response.ResponseCode ?? "cardcom_refund_failed"),
        errorMessage: response.Description || "CardCom refund failed",
      };
    } catch (error) {
      this.logError("refund failed", error);
      return {
        success: false,
        errorCode: "cardcom_refund_error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ─── helpers ──────────────────────────────────────────────────

  private extractLowProfileId(body: unknown): string | null {
    if (!body || typeof body !== "object") return null;
    const obj = body as Record<string, unknown>;
    // CardCom posts LowProfileId; accept a couple of casings defensively.
    const raw = obj.LowProfileId ?? obj.lowProfileId ?? obj.lowprofilecode ?? obj.LowProfileCode;
    return raw ? String(raw) : null;
  }

  private buildCallbackUrl(tenantSlug: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
    return `${baseUrl.replace(/\/$/, "")}/api/payments/callback?provider=cardcom&tenant=${encodeURIComponent(tenantSlug)}`;
  }
}
