export type DeliveryProviderId = "bali";

export interface DeliveryProviderField {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
}

export interface DeliveryProviderMeta {
  id: DeliveryProviderId;
  label: string;
  description: string;
  fields: DeliveryProviderField[];
}

export const DELIVERY_PROVIDERS: DeliveryProviderMeta[] = [
  {
    id: "bali",
    label: "בא לי",
    description: "חברת שליחויות. ההזמנה נשלחת אליהם והם שולחים שליח לאסוף אותה.",
    fields: [
      { key: "shopId", label: "מזהה המסעדה אצל בא לי", placeholder: "לדוגמה test1" },
      { key: "apiKey", label: "מפתח API (x-api-key)", secret: true },
    ],
  },
];

export function providerMeta(id: string): DeliveryProviderMeta | undefined {
  return DELIVERY_PROVIDERS.find((p) => p.id === id);
}

export function providerLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return providerMeta(id)?.label ?? id;
}
