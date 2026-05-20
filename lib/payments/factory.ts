/**
 * Payment provider factory.
 *
 * Loads a tenant's PaymentProviderConfig row, instantiates the matching
 * provider class, and configures it for use.
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
  // cash has no provider implementation — handled inline by order code
};

export function createProviderInstance(type: ProviderType): IPaymentProvider {
  const Ctor = REGISTRY[type];
  if (!Ctor) {
    throw new Error(`No provider implementation for "${type}"`);
  }
  return new Ctor();
}

/**
 * Get the active provider for a tenant. If providerType isn't specified, uses
 * the tenant's default (Tenant.paymentProvider).
 */
export async function getConfiguredProvider(
  tenantId: string,
  providerType?: ProviderType,
): Promise<IPaymentProvider | null> {
  let resolvedType = providerType;

  if (!resolvedType) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { paymentProvider: true },
    });
    if (!tenant) return null;
    resolvedType = tenant.paymentProvider;
  }

  if (resolvedType === PaymentProvider.cash) return null; // cash has no SDK

  const row = await prisma.paymentProviderConfig.findUnique({
    where: { tenantId_provider: { tenantId, provider: resolvedType } },
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
