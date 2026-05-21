/**
 * Base class shared by all server-side payment providers.
 */

import type {
  IPaymentProvider,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  ParsedCallback,
  ProviderConfig,
  ProviderType,
  RefundRequest,
  RefundResponse,
  WebhookValidationResult,
} from "./types";

export abstract class BasePaymentProvider implements IPaymentProvider {
  abstract readonly providerType: ProviderType;
  abstract readonly displayName: string;

  protected config: ProviderConfig | null = null;

  configure(config: ProviderConfig): void {
    this.validateConfig(config);
    this.config = config;
  }

  protected ensureConfigured(): void {
    if (!this.config) {
      throw new Error(`Payment provider ${this.providerType} is not configured`);
    }
  }

  protected abstract validateConfig(config: ProviderConfig): void;

  abstract initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResponse>;
  abstract validateWebhook(body: unknown, headers: Record<string, string>): WebhookValidationResult;
  abstract parseCallback(body: unknown): ParsedCallback;
  abstract acknowledgeCallback(parsed: ParsedCallback): Promise<{ success: boolean; error?: string }>;
  abstract refund(req: RefundRequest): Promise<RefundResponse>;

  /**
   * Normalize an amount (in shekels) to at-most 2 decimals. Returns a *number*,
   * not a string — Grow's server-side validation rejects price/sum values
   * formatted as "28.00" with the misleading "סכום הכללי…אינו זהה" error,
   * even when the arithmetic reconciles. Sending the bare number (which
   * URLSearchParams stringifies as "28") matches the working QuickShop10
   * integration exactly.
   */
  protected formatAmount(shekels: number): number {
    return Math.round(shekels * 100) / 100;
  }

  protected log(message: string, data?: unknown): void {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[payments:${this.providerType}] ${message}`, data ?? "");
    }
  }

  protected logError(message: string, error: unknown): void {
    console.error(`[payments:${this.providerType}] ERROR: ${message}`, error);
  }
}
