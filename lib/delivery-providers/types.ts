import type { DeliveryProviderSettings } from "@/lib/delivery-providers/config";

export interface ProviderOrder {
  number: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  street: string;
  entrance: string;
  apartment: string;
  floor: string;
  remarks: string;
  lat: number | null;
  lng: number | null;
  cashToCollect: number | null;
  tip: number;
}

export interface ProviderOrderRef {
  number: string;
  ref: string | null;
}

export interface ProviderSendResult {
  ok: boolean;
  status: number;
  response: string;
  error: string | null;
  ref?: string | null;
}

export interface DeliveryProviderAdapter {
  send(order: ProviderOrder, settings: DeliveryProviderSettings): Promise<ProviderSendResult>;
  cancel?(order: ProviderOrderRef, settings: DeliveryProviderSettings): Promise<ProviderSendResult>;
  ready?(order: ProviderOrderRef, settings: DeliveryProviderSettings): Promise<ProviderSendResult>;
}
