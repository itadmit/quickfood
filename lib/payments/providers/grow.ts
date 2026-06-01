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

/**
 * Grow sometimes returns `message` / `err` as a nested object — most often a
 * `{id, message}` validation wrapper. Flatten any non-string to a readable
 * string so it survives a JSON round-trip and never reaches React as a
 * raw object (which would throw React #31 when rendered as a child).
 */
function stringifyGrowField(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const obj = value as { message?: unknown; id?: unknown };
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.id === "string" && obj.id) return obj.id;
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

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
  // Grow's API returns this as a NUMBER in some endpoints/responses and as a
  // STRING in others — accept both. Truthy `1` (number or string) = success.
  status: string | number;
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
    let parsed: T;
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      this.logError(`Non-JSON response from ${endpoint}`, {
        status: res.status,
        body: text.slice(0, 500),
      });
      throw new Error(`Grow API non-JSON response (HTTP ${res.status})`);
    }
    // Diagnostic: if Grow logically rejects the call (status != 1), dump the
    // *exact wire form-body* (with apiKey redacted) so we can compare against
    // the working QuickShop10 baseline byte-for-byte.
    const status = (parsed as { status?: unknown })?.status;
    if (status !== undefined && String(status) !== "1") {
      const redacted = formBody.replace(/apiKey=[^&]*/g, "apiKey=***");
      this.logError(`${endpoint} wire body (redacted)`, { body: redacted });
    }
    return parsed;
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

      // NOTE: we deliberately do not build `productData` here — see comment
      // on the body below. Grow's `sum`-vs-products validator rejects every
      // shape we tried (string/number prices, unique/sequential catalog
      // numbers, Hebrew/ASCII descriptions), so we omit the field entirely
      // and Grow accepts `sum` as the source of truth.

      const maxInstallments = Number(this.config!.settings?.maxInstallments) || 1;

      const body: Record<string, unknown> = {
        userId: this.userId,
        pageCode: this.pageCode,
        chargeType: 1, // regular charge
        sum: this.formatAmount(req.amount),
        successUrl: req.successUrl,
        cancelUrl: req.cancelUrl || req.failureUrl,
        notifyUrl: this.buildCallbackUrl(req.tenantSlug),
        // Async invoice/receipt callback (only fires if the tenant has
        // invoice generation enabled in their Grow control panel).
        invoiceNotifyUrl: this.buildInvoiceCallbackUrl(req.tenantSlug),
        description,
        "pageField[fullName]": fullName,
        "pageField[phone]": phone,
        "pageField[email]": this.sanitize(req.customer.email, 80),
        cField1: this.sanitize(req.orderReference, 50),
        cField2: this.sanitize(req.tenantId, 50),
        // ⚠ productData is intentionally NOT sent. Grow's validator rejects
        // every shape we tried (str/num prices, unique/sequential catalog
        // numbers, Hebrew/ASCII descriptions) with err 617 ("סכום הכללי…
        // אינו זהה"), even when the wire body has Σ(price × quantity) ===
        // sum bit-exact. Omitting the field lets Grow trust `sum`; verified
        // 200 OK against sandbox. Trade-off: customer sees only the total
        // in Grow's wallet/invoice, not a line-by-line breakdown. Re-add
        // only after confirming Grow has fixed the validator.
      };

      if (maxInstallments > 1) body.maxPaymentNum = Math.min(maxInstallments, 12);

      const commission = process.env.GROW_COMPANY_COMMISSION;
      if (commission && Number(commission) > 0) body.companyCommission = Number(commission);

      const response = await this.post<GrowResponse<CreatePaymentProcessData>>(
        "/createPaymentProcess",
        body,
        { "X-API-KEY": this.apiKey },
      );

      // Log the actual Grow response so we can diagnose initiate failures.
      // Don't dump the entire request body (PII / VAT-able amount fields).
      // We log at error-level on failure so it surfaces in Vercel prod logs
      // (this.log() is dev-only); successes stay quiet to avoid noise.
      if (String(response.status) !== "1") {
        // Log Grow's complaint AND the request fields most likely to have
        // triggered it — without the request side we'd be guessing.
        // Redact: phone → last 3 digits; email → masked local-part; URLs
        // → host only; commission / apiKey never logged.
        const maskedPhone = phone ? `***${phone.slice(-3)}` : "";
        const maskedEmail = (() => {
          const e = String(body["pageField[email]"] ?? "");
          if (!e || !e.includes("@")) return e ? "***" : "";
          const [local, domain] = e.split("@");
          return `${local.slice(0, 1)}***@${domain}`;
        })();
        const hostOf = (u: string): string => {
          try {
            return new URL(u).host;
          } catch {
            return "(invalid)";
          }
        };
        this.logError("createPaymentProcess failed", {
          response: {
            status: response.status,
            err: response.err,
            message: response.message,
            data: response.data,
          },
          request: {
            testMode: this.config?.testMode,
            userId: this.userId,
            pageCode: this.pageCode,
            sum: body.sum,
            chargeType: body.chargeType,
            successHost: hostOf(String(body.successUrl ?? "")),
            cancelHost: hostOf(String(body.cancelUrl ?? "")),
            notifyHost: hostOf(String(body.notifyUrl ?? "")),
            fullName,
            phone: maskedPhone,
            email: maskedEmail,
            description,
            cField1: body.cField1,
            cField2: body.cField2,
            productCount: req.items.length,
            maxPaymentNum: body.maxPaymentNum,
            hasCommission: typeof body.companyCommission === "number",
          },
        });
      } else {
        this.log("createPaymentProcess response", {
          status: response.status,
          data: response.data,
        });
      }

      if (String(response.status) === "1" && response.data) {
        // Grow returns processId as a number; our DB column is String.
        // Coerce here so the route never tries to write an Int into it.
        const reqId =
          response.data.processId !== undefined
            ? String(response.data.processId)
            : response.data.authCode;

        // SDK Wallet mode
        if (response.data.authCode) {
          return {
            success: true,
            sdkAuthCode: response.data.authCode,
            providerRequestId: reqId,
            providerResponse: response as unknown as Record<string, unknown>,
          };
        }
        // Redirect mode
        if (response.data.url) {
          return {
            success: true,
            paymentUrl: response.data.url,
            providerRequestId: reqId,
            providerResponse: response as unknown as Record<string, unknown>,
          };
        }
      }

      return {
        success: false,
        errorCode: stringifyGrowField(response.err) || "grow_initiate_failed",
        // Grow occasionally returns `message` as a nested object (e.g. validation
        // error wrappers shaped like `{id, message}`). Flatten to a string so we
        // don't leak a non-string through `apiError` → JSON.stringify → client,
        // which would trigger React #31 when the client renders the message.
        errorMessage:
          stringifyGrowField(response.message) ||
          stringifyGrowField(response.err) ||
          "Failed to create payment process",
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

      if (String(response.status) === "1") return { success: true };
      return {
        success: false,
        error:
          stringifyGrowField(response.message) ||
          stringifyGrowField(response.err) ||
          "Approve failed",
      };
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

      if (String(response.status) === "1") {
        return {
          success: true,
          providerRefundId: response.data?.refundTransactionId || req.providerTransactionId,
          refundedAmount: response.data?.refundedAmount ?? req.amount,
        };
      }
      return {
        success: false,
        errorCode: stringifyGrowField(response.err) || "grow_refund_failed",
        errorMessage:
          stringifyGrowField(response.message) ||
          stringifyGrowField(response.err) ||
          "Refund failed",
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

  // Async callback Grow fires once an invoice is generated for the
  // transaction. Body is a JSON array (note the brackets) — see
  // grow-il.readme.io/reference/invoice-server-response.
  private buildInvoiceCallbackUrl(tenantSlug: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl) throw new Error("NEXT_PUBLIC_APP_URL is not configured");
    return `${baseUrl.replace(/\/$/, "")}/api/payments/invoice-callback?provider=grow&tenant=${encodeURIComponent(tenantSlug)}`;
  }

  private extractClientIp(headers: Record<string, string>): string | null {
    const xff = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
    if (xff) return xff.split(",")[0].trim();
    const real = headers["x-real-ip"] || headers["X-Real-IP"];
    if (real) return real.trim();
    return null;
  }
}
