/**
 * Payment provider factory.
 *
 * Loads a tenant's PaymentProviderConfig row, instantiates the matching
 * provider class, and configures it for use.
 *
 * In the multi-provider model, callers must specify which provider they want
 * (no more "default" on the tenant). For cash there's no provider - order
 * code handles it inline.
 */

import { prisma } from "@/lib/db/client";
import { PaymentProvider } from "@prisma/client";
import { GrowProvider } from "./providers/grow";
import type {
  IPaymentProvider,
  ProviderConfig,
  ProviderCredentials,
  ProviderSettings,
  ProviderType,
} from "./types";

type ProviderCtor = new () => IPaymentProvider;

const REGISTRY: Partial<Record<ProviderType, ProviderCtor>> = {
  grow: GrowProvider,
  // cash has no provider implementation - handled inline by order code
};

export function createProviderInstance(type: ProviderType): IPaymentProvider {
  const Ctor = REGISTRY[type];
  if (!Ctor) {
    throw new Error(`No provider implementation for "${type}"`);
  }
  return new Ctor();
}

/**
 * Get a configured provider for a tenant. Returns null if the tenant doesn't
 * have an active config for that provider, or for `cash` (no SDK).
 */
export async function getConfiguredProvider(
  tenantId: string,
  providerType: ProviderType,
): Promise<IPaymentProvider | null> {
  if (providerType === PaymentProvider.cash) return null; // cash has no SDK

  const row = await prisma.paymentProviderConfig.findUnique({
    where: { tenantId_provider: { tenantId, provider: providerType } },
  });

  if (!row || !row.isActive) return null;

  const config: ProviderConfig = {
    provider: row.provider,
    credentials: (row.credentials ?? {}) as ProviderCredentials,
    settings: (row.settings ?? {}) as ProviderSettings,
    testMode: row.testMode,
    isActive: row.isActive,
  };

  const provider = createProviderInstance(row.provider);
  provider.configure(config);
  return provider;
}
