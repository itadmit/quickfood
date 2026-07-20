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
import { CardComProvider } from "./providers/cardcom";
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
  cardcom: CardComProvider,
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

export interface ActiveCardProvider {
  type: ProviderType;
  provider: IPaymentProvider;
  testMode: boolean;
  settings: ProviderSettings;
}

/**
 * Resolve the tenant's single active card provider (grow OR cardcom). Cash is
 * never a "card provider". The merchant settings enforce that only one non-cash
 * provider is active at a time; if two rows are somehow active, the most
 * recently updated one wins (deterministic). Returns null when the tenant has
 * no active card provider (identical to the old grow-only "provider_unavailable").
 */
export async function getActiveCardProvider(
  tenantId: string,
): Promise<ActiveCardProvider | null> {
  const rows = await prisma.paymentProviderConfig.findMany({
    where: {
      tenantId,
      isActive: true,
      provider: { not: PaymentProvider.cash },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (rows.length === 0) return null;

  const row = rows[0];
  const settings = (row.settings ?? {}) as ProviderSettings;
  const config: ProviderConfig = {
    provider: row.provider,
    credentials: (row.credentials ?? {}) as ProviderCredentials,
    settings,
    testMode: row.testMode,
    isActive: row.isActive,
  };
  const provider = createProviderInstance(row.provider);
  provider.configure(config);
  return { type: row.provider, provider, testMode: row.testMode, settings };
}

/**
 * Lightweight variant for server components that only need to know which card
 * provider is active and how to present it - no provider instantiation.
 */
export async function getActiveCardProviderSummary(tenantId: string): Promise<{
  provider: "grow" | "cardcom";
  testMode: boolean;
  displayMode: "iframe" | "redirect";
} | null> {
  const rows = await prisma.paymentProviderConfig.findMany({
    where: {
      tenantId,
      isActive: true,
      provider: { not: PaymentProvider.cash },
    },
    orderBy: { updatedAt: "desc" },
    select: { provider: true, testMode: true, settings: true },
  });
  if (rows.length === 0) return null;
  const row = rows[0];
  const settings = (row.settings ?? {}) as ProviderSettings;
  return {
    provider: row.provider as "grow" | "cardcom",
    testMode: row.testMode,
    displayMode: settings.displayMode === "iframe" ? "iframe" : "redirect",
  };
}
