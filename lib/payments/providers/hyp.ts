/**
 * Hyp provider (formerly YaadPay / Yaad Sarig), hosted payment page.
 *
 * Docs: https://developers.hyp.co.il - ONE endpoint, behaviour switched by
 * `action`. Ported from the QuickShop10 integration (src/lib/payments/providers/hyp.ts).
 *
 * Auth model (all per-tenant, no platform-level env):
 *   Masof - terminal number
 *   PassP - API password
 *   KEY   - API key (used only for the signing/verify steps)
 *
 * Flow - differs from BOTH Grow and CardCom in one critical way: Hyp has no
 * server-to-server webhook, and it does NOT accept a per-request return URL.
 *
 *   1. initiatePayment: server->server GET `action=APISign&What=SIGN&...`. Hyp
 *      answers with a url-encoded query string carrying every param back plus a
 *      `signature`. We strip the secrets (What/KEY/PassP), force `action=pay`,
 *      and hand the customer `https://pay.hyp.co.il/p/?<query>`.
 *   2. Customer pays. Hyp redirects the BROWSER to the return address configured
 *      on the terminal in the Hyp portal (NOT passed per-request) with the result
 *      as GET params. Each merchant points that at
 *      /api/payments/hyp/return?tenant=<slug> - the settings screen shows them
 *      the exact URL to paste.
 *   3. parseCallback re-signs those params via `action=APISign&What=VERIFY`.
 *      Hyp answers CCode=0 only when the transaction is authentic and untampered.
 *      The redirect params are client-controlled and forgeable, so a success is
 *      NEVER recorded off the redirect alone.
 *   4. No ack step - there is nothing to acknowledge.
 *
 * CCode: 0 = charged (J4), 700 = J5 auth approved (hold, not captured),
 * 800 = postponed (awaiting commit). Anything else = failure.
 *
 * Amounts are whole/decimal shekels end-to-end, same as Grow's `sum` and
 * CardCom's `Amount` (QuickFood does NOT use agorot in these fields).
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

/** 1 = ILS. The hosted page is ILS-only. */
const COIN_ILS = "1";

/** CCodes Hyp considers approved. 700/800 are holds, not captures. */
const APPROVED_CCODES = new Set(["0", "700", "800"]);

/**
 * Params we inject ourselves (routing hints + auth) and must strip before
 * replaying the redirect back to Hyp for VERIFY - they would otherwise land
 * mid-string and break the positional signature check.
 */
const NON_HYP_KEYS = new Set([
  "action",
  "What",
  "Masof",
  "KEY",
  "PassP",
  "tenant",
  "provider",
]);

export class HypProvider extends BasePaymentProvider {
  readonly providerType: ProviderType = "hyp";
  readonly displayName = "Hyp";

  private static readonly ENDPOINT = "https://pay.hyp.co.il/p/";

  protected validateConfig(config: ProviderConfig): void {
    // No test-mode short-circuit (unlike Grow/CardCom): Hyp gives us no shared
    // sandbox terminal, so a tenant must always paste its own credentials.
    const c = config.credentials;
    if (!c.masof) throw new Error("Hyp: credentials.masof is required");
    if (!c.passP) throw new Error("Hyp: credentials.passP is required");
    if (!c.apiKey) throw new Error("Hyp: credentials.apiKey is required");
  }

  private get masof(): string {
    return this.config!.credentials.masof!;
  }

  private get passP(): string {
    return this.config!.credentials.passP!;
  }

  private get key(): string {
    return this.config!.credentials.apiKey!;
  }

  private get displayMode(): PaymentDisplayMode {
    return this.config!.settings?.displayMode === "iframe" ? "iframe" : "redirect";
  }

  /**
   * GET the Hyp endpoint. Responses to SIGN/VERIFY are url-encoded query
   * strings, returned raw for the caller to parse. Param ORDER is preserved
   * from the object - VERIFY validates the signature positionally.
   */
  private async request(params: Record<string, string>): Promise<string> {
    this.ensureConfigured();
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) search.set(k, String(v));
    }
    const url = `${HypProvider.ENDPOINT}?${search.toString()}`;
    this.log("GET", { action: params.action, what: params.What });

    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    this.log("Response", { status: res.status, preview: text.slice(0, 200) });
    return text;
  }

  /**
   * Hyp's itemised-invoice string: concatenated `[0~<name>~<qty>~<unit>]`
   * blocks. The initiate core already appends negative-price lines for
   * discounts, which Hyp reads as discount rows. Block delimiters are stripped
   * from names so they can't corrupt the string.
   */
  private buildHeshDesc(items: InitiatePaymentRequest["items"]): string {
    return items
      .map((item) => {
        const name = (item.name || "פריט").replace(/[[\]~]/g, " ").trim().slice(0, 60);
        const qty = item.quantity || 1;
        return `[0~${name}~${qty}~${this.amountStr(item.price)}]`;
      })
      .join("");
  }

  private amountStr(shekels: number): string {
    const amount = this.formatAmount(shekels);
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse> {
    this.ensureConfigured();
    try {
      const maxInstallments = Number(this.config!.settings?.maxInstallments) || 1;
      const nameParts = (req.customer.name || "").trim().split(/\s+/);

      // Only send the itemised invoice when the lines actually add up to what
      // we're charging. They don't in the POS split-payment flow (cash covers
      // part of the order and Hyp charges the remainder) - there, an itemised
      // breakdown that over-states the charge would be wrong on the receipt
      // and risks an Amount/Pritim mismatch at Hyp.
      const itemsTotal = req.items.reduce(
        (sum, it) => sum + it.price * (it.quantity || 1),
        0,
      );
      const itemised = Math.abs(this.formatAmount(itemsTotal) - this.formatAmount(req.amount)) < 0.01;

      const signParams: Record<string, string> = {
        action: "APISign",
        What: "SIGN",
        KEY: this.key,
        PassP: this.passP,
        Masof: this.masof,
        Amount: this.amountStr(req.amount),
        Coin: COIN_ILS,
        Order: req.orderReference,
        Info: `הזמנה ${req.orderReference}`.slice(0, 80),
        Tash: String(maxInstallments),
        FixTash: "False",
        UTF8: "True",
        UTF8out: "True",
        // REQUIRED: makes Hyp sign the callback params. Without it the redirect
        // carries no Sign and VERIFY has nothing to validate -> always fails.
        Sign: "True",
        MoreData: "True", // returns UID (token) + card details on the callback
        PageLang: "HEB",
        ...(itemised
          ? { Pritim: "True", heshDesc: this.buildHeshDesc(req.items) }
          : {}),
        J5: "False", // immediate charge, not auth-only
        Postpone: "False",
        ClientName: nameParts[0] || "",
        ClientLName: nameParts.slice(1).join(" ") || "",
        email: req.customer.email || "",
        cell: req.customer.phone || "",
        phone: req.customer.phone || "",
        // Hyp requires UserId (Israeli ID) to be present. QuickFood never
        // collects it; terminals that don't enforce ID accept 0.
        UserId: "0",
        // Custom echo field - Hyp returns Fild1 to us. Carries the tenant slug
        // so the return route can still resolve the tenant when a merchant
        // pasted the generic return URL without ?tenant=.
        Fild1: req.tenantSlug,
      };

      if (this.config!.settings?.hypSendInvoice === true) {
        signParams.SendHesh = "True";
        signParams.sendemail = "True";
      }

      const signed = new URLSearchParams((await this.request(signParams)).trim());
      const signature = signed.get("signature");

      if (!signature) {
        // Hyp returned an error (bad credentials/params) instead of a signature.
        const errMsg =
          signed.get("errMsg") || signed.get("Error") || "Failed to sign Hyp payment request";
        this.logError("APISign returned no signature", { errMsg, masof: this.masof });
        return {
          success: false,
          errorCode: signed.get("CCode") || "hyp_sign_failed",
          errorMessage: errMsg,
          providerResponse: Object.fromEntries(signed.entries()),
        };
      }

      // Build the customer-facing URL from the signed echo: drop the secrets,
      // flip to action=pay, keep the signature. Hyp recomputes the signature
      // from the params alphabetically, so URL param order is irrelevant here.
      signed.delete("What");
      signed.delete("KEY");
      signed.delete("PassP");
      signed.set("action", "pay");

      return {
        success: true,
        paymentUrl: `${HypProvider.ENDPOINT}?${signed.toString()}`,
        displayMode: this.displayMode,
        // Hyp has no process id - the callback matches on `Order`.
        providerRequestId: req.orderReference,
        providerResponse: { signed: true },
      };
    } catch (error) {
      this.logError("initiatePayment failed", error);
      return {
        success: false,
        errorCode: "hyp_error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Nothing to validate at this layer: Hyp signs no webhook body (there is no
   * webhook). Authenticity comes from the VERIFY round-trip in parseCallback.
   */
  validateWebhook(_body: unknown, _headers: Record<string, string>): WebhookValidationResult {
    this.ensureConfigured();
    return { isValid: true };
  }

  /**
   * Authoritative parse. Takes the params Hyp redirected the browser with,
   * replays them to Hyp as `What=VERIFY`, and only reports success when Hyp
   * answers CCode=0. A forged redirect fails the signature check and lands
   * here as a failure.
   */
  async parseCallback(body: unknown): Promise<ParsedCallback> {
    this.ensureConfigured();
    const data = (body && typeof body === "object" ? body : {}) as Record<
      string,
      string | undefined
    >;
    const ccode = String(data.CCode ?? "");
    const rawAmount = data.Amount !== undefined ? Number(data.Amount) : 0;

    const base: ParsedCallback = {
      success: false,
      status: "failed" as TransactionStatus,
      providerTransactionId: data.Id ? String(data.Id) : "",
      providerRequestId: data.Order ? String(data.Order) : undefined,
      amount: Number.isFinite(rawAmount) ? rawAmount : 0,
      currency: "ILS",
      orderReference: data.Order ? String(data.Order) : undefined,
      errorCode: ccode || "hyp_no_ccode",
      errorMessage: data.errMsg || `Transaction not approved (CCode=${ccode})`,
      rawData: data as Record<string, unknown>,
    };

    // Declined outright - no point spending a VERIFY round-trip on it.
    if (!APPROVED_CCODES.has(ccode)) return base;

    // Hyp validates the `Sign` positionally: the auth params must come FIRST
    // and the redirect params must follow in the exact order Hyp sent them
    // (Id, CCode, Amount, ACode, Order, Fild1, ..., Sign). Object key order is
    // preserved all the way into URLSearchParams.
    const verifyParams: Record<string, string> = {
      action: "APISign",
      What: "VERIFY",
      Masof: this.masof,
      KEY: this.key,
      PassP: this.passP,
    };
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && !NON_HYP_KEYS.has(k)) verifyParams[k] = String(v);
    }

    let verified: URLSearchParams;
    try {
      verified = new URLSearchParams((await this.request(verifyParams)).trim());
    } catch (error) {
      this.logError("VERIFY request failed", error);
      return { ...base, errorCode: "hyp_verify_error", errorMessage: "Hyp verification failed" };
    }

    const verifyCCode = verified.get("CCode");
    if (verifyCCode !== "0") {
      this.logError("VERIFY rejected the transaction", { verifyCCode, ccode, order: data.Order });
      return {
        ...base,
        errorCode: "hyp_verify_failed",
        errorMessage:
          verified.get("errMsg") || `Hyp verification failed (VERIFY CCode=${verifyCCode})`,
        rawData: { ...(data as Record<string, unknown>), verify: Object.fromEntries(verified) },
      };
    }

    this.log("Verified", { order: data.Order, ccode, id: data.Id });

    return {
      success: true,
      status: "success",
      providerTransactionId: data.Id ? String(data.Id) : "",
      providerRequestId: data.Order ? String(data.Order) : undefined,
      approvalNumber: data.ACode || undefined,
      amount: Number.isFinite(rawAmount) ? rawAmount : 0,
      currency: "ILS",
      orderReference: data.Order ? String(data.Order) : undefined,
      cardLastFour: data.L4digit || undefined,
      // Hyp's token UID (returned because MoreData=True). Not usable for
      // refunds - kept so a future tokenised-charge flow has it.
      providerToken: data.UID || undefined,
      rawData: { ...(data as Record<string, unknown>), verify: Object.fromEntries(verified) },
    };
  }

  /** Nothing to acknowledge - Hyp doesn't retry anything. */
  async acknowledgeCallback(): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  /**
   * Hyp's hosted-page API exposes no refund call we can automate without
   * risking double-refunds. Merchants issue them from the Hyp portal.
   */
  async refund(_req: RefundRequest): Promise<RefundResponse> {
    return {
      success: false,
      errorCode: "hyp_refund_manual",
      errorMessage: "זיכוי ב-Hyp מתבצע ידנית בפורטל של Hyp (יעד שריג)",
    };
  }

  /**
   * Credential check: sign a ₪1 dummy request. A returned `signature` means
   * Masof/PassP/KEY are all valid.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    this.ensureConfigured();
    try {
      const signed = new URLSearchParams(
        (
          await this.request({
            action: "APISign",
            What: "SIGN",
            KEY: this.key,
            PassP: this.passP,
            Masof: this.masof,
            Amount: "1",
            Coin: COIN_ILS,
            Order: "test-connection",
            Info: "test",
            Tash: "1",
            UTF8: "True",
            UTF8out: "True",
          })
        ).trim(),
      );
      if (signed.get("signature")) return { success: true };
      return {
        success: false,
        error: signed.get("errMsg") || "פרטי התחברות שגויים - בדוק Masof / PassP / KEY",
      };
    } catch (error) {
      this.logError("testConnection failed", error);
      return { success: false, error: error instanceof Error ? error.message : "החיבור נכשל" };
    }
  }
}

/**
 * The return address a merchant must paste into their Hyp terminal (portal ->
 * terminal settings -> post-transaction redirect, for BOTH the success and the
 * failure address). Hyp doesn't take a per-request return URL, so this is the
 * only way the result gets back to us.
 */
export function buildHypReturnUrl(tenantSlug: string, origin?: string): string {
  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return `${base}/api/payments/hyp/return?tenant=${encodeURIComponent(tenantSlug)}`;
}
