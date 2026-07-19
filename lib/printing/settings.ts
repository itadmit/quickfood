// Tenant.printerSettings (JSONB) resolution. Kept free of server-only
// imports (mqtt) so client components can import the type + resolver.

export interface CloudPrinterSettings {
  enabled: boolean;
  deviceTopic: string;
  printCashOnCreate: boolean;
  printCardOnPaid: boolean;
  copies: number;
}

export function resolvePrinterSettings(raw: unknown): CloudPrinterSettings {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const copies = Number(o.copies);
  return {
    enabled: o.enabled === true,
    deviceTopic: typeof o.device_topic === "string" ? o.device_topic.trim() : "",
    printCashOnCreate: o.print_cash_on_create !== false,
    printCardOnPaid: o.print_card_on_paid !== false,
    copies: Number.isInteger(copies) && copies >= 1 && copies <= 3 ? copies : 1,
  };
}
