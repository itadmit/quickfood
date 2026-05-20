/**
 * Grow Payments provider (formerly Meshulam).
 *
 * Israeli payment gateway. Multi-tenant via platform apiKey + per-tenant userId.
 * Docs: https://grow-il.readme.io
 *
 * Auth model:
 *   apiKey   — body param on every call (env GROW_API_KEY)
 *   X-API-KEY — header, only on /createPaymentProcess
 *   pageCode — env GROW_PAGE_CODE (override per tenant via credentials.pageCode)
 *   userId   — per tenant, in PaymentProviderConfig.credentials
 *
 * Callbacks are S2S, form-urlencoded, with no HMAC — security is IP whitelist +
 * unguessable notifyUrl. Acknowledge via /approveTransaction or Grow will retry
 * the callback up to 6 times.
 */

import { BasePaymentProvider } from "../base";
import type {
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  ParsedCallback,
  ProviderConfig,
  ProviderType,
  RefundRequest,
  RefundResponse,
  TransactionStatus,
  WebhookValidationResult,
} from "../types";

// ─── Grow IPs (no HMAC available — IP whitelist is best we have) ──

const GROW_LIVE_IPS = new Set<string>([
  "18.158.107.17", "3.121.149.170", "3.76.166.104", "3.69.160.29", "3.78.79.166",
  "3.71.221.153", "3.78.131.18", "3.67.110.47", "18.192.112.151", "52.59.95.229",
  "18.158.145.146", "3.75.128.58", "3.78.28.179", "3.122.21.187", "3.66.126.119",
  "35.158.249.118", "52.29.70.254", "52.59.159.234", "3.76.183.119", "18.157.106.67",
  "18.156.94.176", "18.197.238.68", "3.66.129.154", "3.77.123.153", "3.70.40.72",
]);

const GROW_TEST_IPS = new Set<string>([
  "3.123.194.128", "3.124.62.248", "18.198.97.252", "3.75.43.49", "18.156.94.176",
]);

const STATUS_MAP: Record<string, TransactionStatus> = {
  "0": "failed",
  "2": "success",
  "4": "cancelled",
  "6": "success", // refund
  "9": "failed",
};

const CARD_BRAND_MAP: Record<string, string> = {
  "2": "mastercard",
  "3": "visa",
  "5": "isracard",
  "7": "discover",
  "8": "diners",
};

// ─── Grow response shapes ─────────────────────────────────────

interface GrowResponse<T = unknown> {
  err?: string;
  status: string; // "1" = success, anything else = error
  data?: T;
  message?: string;
}

interface CreatePaymentProcessData {
  url?: string;
  processId?: string;
  processToken?: string;
  authCode?: string; // SDK Wallet mode
}

interface RefundData {
  refundTransactionId?: string;
  refundedAmount?: number;
  asmachta?: string;
}

type GrowCallbackRaw = Record<string, string | undefined> & {
  data?: {
    asmachta?: string;
    cardSuffix?: string;
    cardBrand?: string;
    cardBrandCode?: string;
    statusCode?: string;
    transactionId?: string;
    transactionToken?: string;
    processId?: string;
    processToken?: string;
    sum?: string | number;
    customFields?: Record<string, string>;
  };
};

// ─── Provider ─────────────────────────────────────────────────

export class GrowProvider extends BasePaymentProvider {
  readonly providerType: ProviderType = "grow";
  readonly displayName = "Grow";

  private static readonly SANDBOX_URL = "https://sandbox.meshulam.co.il/api/light/server/1.0";
  private static readonly PRODUCTION_URL = "https://secure.meshulam.co.il/api/light/server/1.0";

  protected validateConfig(config: ProviderConfig): void {
    if (!config.credentials.userId) {
      throw new Error("Grow: credentials.userId is required");
    }
    if (!process.env.GROW_API_KEY) {
      throw new Error("Grow: GROW_API_KEY env var is required");
    }
    const pageCode = config.credentials.pageCode || process.env.GROW_PAGE_CODE;
    if (!pageCode) {
      throw new Error("Grow: GROW_PAGE_CODE env var or credentials.pageCode is required");
    }
  }

  // ─── Internals ──────────────────────────────────────────────

  private get apiUrl(): string {
    this.ensureConfigured();
    return this.config!.testMode ? GrowProvider.SANDBOX_URL : GrowProvider.PRODUCTION_URL;
  }

  private get apiKey(): string {
    return process.env.GROW_API_KEY!;
  }

  private get pageCode(): string {
    return this.config!.credentials.pageCode || process.env.GROW_PAGE_CODE!;
  }

  private get userId(): string {
    return this.config!.credentials.userId!;
  }

  /**
   * Grow rejects "special chars" silently. Keep letters (incl. Hebrew), digits,
   * whitespace, and a handful of punctuation.
   */
  private sanitize(input: string | undefined | null, maxLen = 100): string {
    if (!input) return "";
    return String(input)
      .replace(/[^\p{L}\p{N}\s.\-_@]/gu, "")
      .trim()
      .slice(0, maxLen);
  }

  /**
   * Normalize to Israeli mobile format: 10 digits starting with `05`.
   * Grow rejects anything else. Accepts +972, 972, 00972, with or without
   * leading 0, dashes, spaces, parentheses.
   * Falls back to a dummy Israeli number if normalization fails.
   */
  private normalizeIsraeliPhone(raw: string | undefined | null): string {
    const FALLBACK = "0500000000";
    if (!raw) return FALLBACK;
    let digits = String(raw).replace(/\D/g, "");
    if (!digits) return FALLBACK;

    // Strip international prefixes ← leave national part
    if (digits.startsWith("00972")) digits = digits.slice(5);
    else if (digits.startsWith("972")) digits = digits.slice(3);

    // Ensure leading 0 on the national part
    if (!digits.startsWith("0")) digits = "0" + digits;

    // Must be a 10-digit mobile starting with 05
    if (digits.length === 10 && digits.startsWith("05")) return digits;

    return FALLBACK;
  }

  private toFormUrlEncoded(obj: Record<string, unknown>): string {
    const params = new URLSearchParams();
    const append = (key: string, value: unknown): void => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (item !== null && typeof item === "object") {
            for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
              append(`${key}[${i}][${k}]`, v);
            }
          } else {
            append(`${key}[${i}]`, item);
          }
        });
      } else if (value !== null && typeof value === "object") {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          append(`${key}[${k}]`, v);
        }
      } else {
        params.append(key, String(value));
      }
    };
    for (const [k, v] of Object.entries(obj)) append(k, v);
    return params.toString();
  }

  private async post<T>(
    endpoint: string,
    body: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    this.ensureConfigured();
    const url = `${this.apiUrl}${endpoint.startsWith("/") ? endpoint : "/" + endpoint}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      ...extraHeaders,
    };
    const fullBody = { apiKey: this.apiKey, ...body };
    const formBody = this.toFormUrlEncoded(fullBody);

    this.log(`POST ${endpoint}`, { bodyKeys: Object.keys(fullBody) });

    const res = await fetch(url, { method: "POST", headers, body: formBody });
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      this.logError(`Non-JSON response from ${endpoint}`, {
        status: res.status,
        body: text.slice(0, 500),
      });
      throw new Error(`Grow API non-JSON response (HTTP ${res.status})`);
    }
  }

  // ─── Public API ─────────────────────────────────────────────

  async initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    this.ensureConfigured();

    try {
      // Grow requires fullName with at least 2 tokens (space-separated).
      let fullName = this.sanitize(req.customer.name, 80);
      if (!fullName.includes(" ")) fullName = `${fullName} .`;

      const phone = this.normalizeIsraeliPhone(req.customer.phone);
      const description = this.sanitize(`Order ${req.orderReference}`, 100);

      const productData = req.items.slice(0, 10).map((item, i) => ({
        catalogNumber: item.sku || String(i + 1),
        quantity: item.quantity,
        price: this.formatAmount(item.price),
        itemDescription: this.sanitize(item.name, 80),
      }));

      const maxInstallments = Number(this.config!.settings?.maxInstallments) || 1;

      const body: Record<string, unknown> = {
        userId: this.userId,
        pageCode: this.pageCode,
        chargeType: 1, // regular charge
        sum: this.formatAmount(req.amount),
        successUrl: req.successUrl,
        cancelUrl: req.cancelUrl || req.failureUrl,
        notifyUrl: this.buildCallbackUrl(req.tenantSlug),
        description,
        "pageField[fullName]": fullName,
        "pageField[phone]": phone,
        "pageField[email]": this.sanitize(req.customer.email, 80),
        cField1: this.sanitize(req.orderReference, 50),
        cField2: this.sanitize(req.tenantId, 50),
        productData,
      };

      if (maxInstallments > 1) body.maxPaymentNum = Math.min(maxInstallments, 12);

      const commission = process.env.GROW_COMPANY_COMMISSION;
      if (commission && Number(commission) > 0) body.companyCommission = Number(commission);

      const response = await this.post<GrowResponse<CreatePaymentProcessData>>(
        "/createPaymentProcess",
        body,
        { "X-API-KEY": this.apiKey },
      );

      if (response.status === "1" && response.data) {
        // SDK Wallet mode
        if (response.data.authCode) {
          return {
            success: true,
            sdkAuthCode: response.data.authCode,
            providerRequestId: response.data.processId || response.data.authCode,
            providerResponse: response as unknown as Record<string, unknown>,
          };
        }
        // Redirect mode
        if (response.data.url) {
          return {
            success: true,
            paymentUrl: response.data.url,
            providerRequestId: response.data.processId,
            providerResponse: response as unknown as Record<string, unknown>,
          };
        }
      }

      return {
        success: false,
        errorCode: response.err || "grow_initiate_failed",
        errorMessage: response.message || response.err || "Failed to create payment process",
        providerResponse: response as unknown as Record<string, unknown>,
      };
    } catch (error) {
      this.logError("initiatePayment failed", error);
      return {
        success: false,
        errorCode: "grow_error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  validateWebhook(_body: unknown, headers: Record<string, string>): WebhookValidationResult {
    this.ensureConfigured();
    const ip = this.extractClientIp(headers);
    if (!ip) {
      if (process.env.NODE_ENV === "production") {
        return { isValid: false, error: "Unable to determine source IP" };
      }
      return { isValid: true };
    }
    const allowed = this.config!.testMode ? GROW_TEST_IPS : GROW_LIVE_IPS;
    if (!allowed.has(ip)) {
      if (process.env.NODE_ENV === "production") {
        return { isValid: false, error: `IP ${ip} not in Grow whitelist` };
      }
      this.log(`Webhook from non-whitelisted IP ${ip} (allowed in dev)`);
    }
    return { isValid: true };
  }

  parseCallback(body: unknown): ParsedCallback {
    let raw: GrowCallbackRaw;
    if (typeof body === "object" && body !== null) {
      raw = body as GrowCallbackRaw;
    } else if (typeof body === "string") {
      try {
        raw = JSON.parse(body) as GrowCallbackRaw;
      } catch {
        const parsed = new URLSearchParams(body);
        const obj: Record<string, string> = {};
        parsed.forEach((v, k) => (obj[k] = v));
        raw = obj as GrowCallbackRaw;
      }
    } else {
      raw = {} as GrowCallbackRaw;
    }

    const get = (flatKey: string, nestedKey?: string): string | undefined => {
      const flatVal = raw[flatKey];
      if (flatVal !== undefined) return flatVal;
      if (nestedKey && raw.data) {
        const v = (raw.data as Record<string, unknown>)[nestedKey];
        return v !== undefined ? String(v) : undefined;
      }
      return undefined;
    };

    const statusCode = get("data[statusCode]", "statusCode") || "";
    const transactionId = get("data[transactionId]", "transactionId") || "";
    const processId = get("data[processId]", "processId");
    const sum = get("data[sum]", "sum");
    const cardSuffix = get("data[cardSuffix]", "cardSuffix");
    const cardBrandCode = get("data[cardBrandCode]", "cardBrandCode");
    const asmachta = get("data[asmachta]", "asmachta");
    const transactionToken = get("data[transactionToken]", "transactionToken");

    const orderReference =
      raw["data[customFields][cField1]"] ?? raw.data?.customFields?.cField1;

    const status = STATUS_MAP[statusCode] ?? "failed";
    const isSuccess = status === "success";

    this.log("Parsed callback", { statusCode, transactionId, processId, orderReference });

    return {
      success: isSuccess,
      status,
      providerTransactionId: transactionId,
      providerRequestId: processId,
      approvalNumber: asmachta,
      amount: Number(sum) || 0,
      currency: "ILS",
      orderReference,
      cardBrand: cardBrandCode ? CARD_BRAND_MAP[cardBrandCode] || cardBrandCode : undefined,
      cardLastFour: cardSuffix,
      providerToken: transactionToken,
      errorCode: !isSuccess ? statusCode : undefined,
      errorMessage: !isSuccess ? get("data[status]", "status") : undefined,
      rawData: raw as unknown as Record<string, unknown>,
    };
  }

  /**
   * Acknowledge a callback (Grow expects /approveTransaction within ~minutes,
   * else retries up to 6 times). Echo back every field Grow sent us — that's
   * their contract.
   */
  async acknowledgeCallback(parsed: ParsedCallback): Promise<{ success: boolean; error?: string }> {
    this.ensureConfigured();

    const raw = parsed.rawData as GrowCallbackRaw;
    const get = (flatKey: string, nestedKey?: string): string | undefined => {
      const flatVal = raw[flatKey];
      if (flatVal !== undefined) return flatVal;
      if (nestedKey && raw.data) {
        const v = (raw.data as Record<string, unknown>)[nestedKey];
        return v !== undefined ? String(v) : undefined;
      }
      return undefined;
    };

    try {
      const body: Record<string, unknown> = {
        userId: this.userId,
        pageCode: this.pageCode,
        transactionId: parsed.providerTransactionId,
        transactionToken: parsed.providerToken,
        transactionTypeId: get("data[transactionTypeId]", "transactionTypeId"),
        paymentType: get("data[paymentType]", "paymentType"),
        sum: get("data[sum]", "sum"),
        firstPaymentSum: get("data[firstPaymentSum]", "firstPaymentSum") || "0",
        periodicalPaymentSum: get("data[periodicalPaymentSum]", "periodicalPaymentSum") || "0",
        paymentsNum: get("data[paymentsNum]", "paymentsNum") || "0",
        allPaymentsNum: get("data[allPaymentsNum]", "allPaymentsNum") || "1",
        paymentDate: get("data[paymentDate]", "paymentDate"),
        asmachta: parsed.approvalNumber,
        description: get("data[description]", "description"),
        fullName: get("data[fullName]", "fullName"),
        payerPhone: get("data[payerPhone]", "payerPhone"),
        payerEmail: get("data[payerEmail]", "payerEmail"),
        cardSuffix: parsed.cardLastFour,
        cardType: get("data[cardType]", "cardType"),
        cardTypeCode: get("data[cardTypeCode]", "cardTypeCode"),
        cardBrand: get("data[cardBrand]", "cardBrand"),
        cardBrandCode: get("data[cardBrandCode]", "cardBrandCode"),
        cardExp: get("data[cardExp]", "cardExp"),
        processId: parsed.providerRequestId,
        processToken: get("data[processToken]", "processToken"),
      };

      const response = await this.post<GrowResponse>("/approveTransaction", body);

      if (response.status === "1") return { success: true };
      return { success: false, error: response.message || response.err || "Approve failed" };
    } catch (error) {
      this.logError("acknowledgeCallback failed", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  async refund(req: RefundRequest): Promise<RefundResponse> {
    this.ensureConfigured();

    try {
      const body: Record<string, unknown> = {
        userId: this.userId,
        transactionId: req.providerTransactionId,
        refundSum: this.formatAmount(req.amount),
      };
      if (req.providerToken) body.transactionToken = req.providerToken;

      const response = await this.post<GrowResponse<RefundData>>("/refundTransaction", body);

      if (response.status === "1") {
        return {
          success: true,
          providerRefundId: response.data?.refundTransactionId || req.providerTransactionId,
          refundedAmount: response.data?.refundedAmount ?? req.amount,
        };
      }
      return {
        success: false,
        errorCode: response.err || "grow_refund_failed",
        errorMessage: response.message || response.err || "Refund failed",
      };
    } catch (error) {
      this.logError("refund failed", error);
      return {
        success: false,
        errorCode: "grow_refund_error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ─── helpers ──────────────────────────────────────────────────

  private buildCallbackUrl(tenantSlug: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
    return `${baseUrl.replace(/\/$/, "")}/api/payments/callback?provider=grow&tenant=${encodeURIComponent(tenantSlug)}`;
  }

  private extractClientIp(headers: Record<string, string>): string | null {
    const xff = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
    if (xff) return xff.split(",")[0].trim();
    const real = headers["x-real-ip"] || headers["X-Real-IP"];
    if (real) return real.trim();
    return null;
  }
}
