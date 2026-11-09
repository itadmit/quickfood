export interface ProviderOrder {
  number: string;
  customerName: string;
  customerPhone: string;
  address: string;
  entrance: string;
  apartment: string;
  floor: string;
  remarks: string;
  lat: number | null;
  lng: number | null;
}

export interface ProviderSendResult {
  ok: boolean;
  status: number;
  response: string;
  error: string | null;
}
